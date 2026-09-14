# CloudWatch — Complete Monitoring and Observability Guide

> Amazon CloudWatch is AWS's monitoring and observability platform. It collects metrics, logs, and events from AWS services and your own applications, enabling you to visualize, alarm, and take action.

---

## Table of Contents

1. [What is CloudWatch?](#1-what-is-cloudwatch)
2. [Metrics](#2-metrics)
3. [CloudWatch Alarms](#3-cloudwatch-alarms)
4. [CloudWatch Logs](#4-cloudwatch-logs)
5. [CloudWatch Logs Insights](#5-cloudwatch-logs-insights)
6. [Metric Filters](#6-metric-filters)
7. [CloudWatch Agent](#7-cloudwatch-agent)
8. [CloudWatch Dashboards](#8-cloudwatch-dashboards)
9. [CloudWatch Events and EventBridge](#9-cloudwatch-events-and-eventbridge)
10. [Container Insights](#10-container-insights)
11. [Application Insights](#11-application-insights)
12. [CloudWatch Pricing](#12-cloudwatch-pricing)
13. [Hands-on Labs](#13-hands-on-labs)
14. [Interview Q&A](#14-interview-qa)

---

## 1. What is CloudWatch?

**Amazon CloudWatch** is a monitoring and management service that provides data and actionable insights for AWS, hybrid, and on-premises applications and infrastructure resources.

### The Four Pillars

```
+----------------------------------------------------------+
|                    CloudWatch                            |
|                                                          |
|  METRICS          LOGS            ALARMS    DASHBOARDS  |
|  +----------+   +----------+   +--------+  +--------+  |
|  | CPU: 45% |   | ERROR 500|   | ALARM! |  | Graphs |  |
|  | Memory:8G|   | GET /api |   | -> SNS |  | Charts |  |
|  | Requests |   | LoginFail|   | -> ASG |  | Tables |  |
|  +----------+   +----------+   +--------+  +--------+  |
+----------------------------------------------------------+
```

### What CloudWatch Monitors

Built-in monitoring (no configuration):
- EC2 instances (CPU, network, disk)
- RDS databases (connections, storage, queries)
- Lambda functions (invocations, errors, duration)
- DynamoDB (reads, writes, latency)
- SQS queues (message age, queue depth)
- ELB/ALB (request count, latency, 5xx rate)
- S3 (storage, requests — must enable)
- And 70+ other AWS services

Custom monitoring (requires configuration):
- Application metrics (business KPIs, custom counters)
- EC2 in-memory metrics (requires CloudWatch Agent)
- On-premises servers (requires CloudWatch Agent)
- Application logs (requires CloudWatch Agent or SDK)

### CloudWatch Architecture

```
AWS Services             Your Applications
    |                          |
    | (automatic)              | (SDK/Agent)
    v                          v
+------------------CloudWatch------------------+
|                                              |
|  Metrics Ingest    Logs Ingest               |
|  (time-series DB)  (log storage)             |
|       |                 |                    |
|  Namespaces         Log Groups               |
|  Dimensions         Log Streams              |
|       |                 |                    |
|  Statistics         Log Insights             |
|  Alarms             Metric Filters           |
|  Dashboards                                  |
+----------------------------------------------+
         |                |
    Actions           Alerts
    - Auto Scale      - SNS Email
    - EC2 restart     - PagerDuty
    - Lambda          - Slack (via SNS)
```

---

## 2. Metrics

A **metric** is a time-ordered set of data points representing a single measurable value over time.

### Metric Anatomy

```
Metric = Namespace + MetricName + Dimensions + Timestamps + Values + Unit

Example:
  Namespace:   AWS/EC2
  MetricName:  CPUUtilization
  Dimensions:  InstanceId=i-0123456789abcdef0
  Timestamp:   2024-01-15T10:00:00Z
  Value:       45.3
  Unit:        Percent
```

### Namespaces

Namespaces are containers for metrics that prevent naming conflicts.

```
AWS Services use: AWS/<ServiceName>
  AWS/EC2           - EC2 metrics
  AWS/RDS           - RDS metrics
  AWS/Lambda        - Lambda metrics
  AWS/ApplicationELB - ALB metrics
  AWS/S3            - S3 metrics (must enable)
  AWS/SQS           - SQS metrics
  AWS/DynamoDB      - DynamoDB metrics

Your custom metrics: YourApp/<Category>
  MyWebApp/Payments   - Custom payment metrics
  MyWebApp/Users      - User registration metrics
```

### Dimensions

Dimensions are name-value pairs that are part of a metric's identity. They filter and segment metrics.

```
EC2 CPUUtilization with different dimensions:

Per instance:
  Namespace: AWS/EC2
  MetricName: CPUUtilization
  Dimension: InstanceId = i-0123456789abcdef0
  -> CPU for specific instance

Per Auto Scaling group:
  Namespace: AWS/EC2
  MetricName: CPUUtilization
  Dimension: AutoScalingGroupName = my-asg
  -> Aggregated CPU across all instances in ASG
```

### Key EC2 Metrics (Built-in)

```
CPU:
  CPUUtilization        - % CPU used (0-100)
  CPUCreditBalance      - T2/T3 burst credits remaining
  CPUCreditUsage        - T2/T3 burst credits used

Network:
  NetworkIn             - Bytes received (per 5 min)
  NetworkOut            - Bytes sent
  NetworkPacketsIn      - Packets received
  NetworkPacketsOut     - Packets sent

Disk (EBS):
  DiskReadBytes         - Bytes read from disk
  DiskWriteBytes        - Bytes written to disk
  DiskReadOps           - Read IOPS
  DiskWriteOps          - Write IOPS

Status:
  StatusCheckFailed     - Combined status check (0 or 1)
  StatusCheckFailed_Instance - Instance status check
  StatusCheckFailed_System   - System status check (hypervisor)
```

### Metrics NOT Available by Default (Need CloudWatch Agent)

```
Memory:
  mem_used_percent      - RAM utilization
  mem_available         - Available memory (bytes)
  mem_used              - Used memory (bytes)

Disk Space:
  disk_used_percent     - Disk space used %
  disk_free             - Free disk space
  
Swap:
  swap_used_percent     - Swap utilization

Processes:
  processes_running     - Running processes count
  processes_sleeping    - Sleeping processes count
```

**Why not available by default?** AWS hypervisor cannot see inside the OS to measure memory. An agent running inside the OS is required.

### Key RDS Metrics

```
Performance:
  CPUUtilization        - Database CPU %
  DatabaseConnections   - Active connections
  FreeableMemory        - Available RAM
  FreeStorageSpace      - Available disk space

Query Performance:
  ReadIOPS              - Read operations per second
  WriteIOPS             - Write operations per second
  ReadLatency           - Avg read latency (seconds)
  WriteLatency          - Avg write latency

Replication (Aurora):
  AuroraReplicaLag      - Replica lag behind primary
  AuroraBinlogReplicaLag - Binlog replica lag
```

### Key Lambda Metrics

```
Invocations:
  Invocations           - Total function invocations
  Errors                - Failed invocations
  Throttles             - Throttled invocations
  
Performance:
  Duration              - Execution time (ms) - avg, p99
  ConcurrentExecutions  - Active instances
  
Async:
  AsyncEventsReceived   - Async invocations received
  AsyncEventAge         - Age of async events
  AsyncEventsDropped    - Dropped async events
```

### Default Metrics vs Custom Metrics

**Default Metrics (built-in):**
- Automatically sent by AWS services
- No configuration needed
- 5-minute resolution for basic, 1-minute for detailed
- Free

**Custom Metrics:**
- You send them via CloudWatch API or SDK
- From your application code
- From CloudWatch Agent on EC2

```python
# Sending custom metric via Python SDK
import boto3

cloudwatch = boto3.client('cloudwatch')

cloudwatch.put_metric_data(
    Namespace='MyWebApp/Payments',
    MetricData=[
        {
            'MetricName': 'PaymentSuccessRate',
            'Dimensions': [
                {'Name': 'Environment', 'Value': 'Production'},
                {'Name': 'PaymentProvider', 'Value': 'Stripe'}
            ],
            'Value': 99.5,
            'Unit': 'Percent'
        }
    ]
)
```

### Metric Resolution

```
Standard Resolution: 1-minute granularity (default for EC2 with detailed monitoring)
  - Data retained for 15 days at 1-min resolution
  - Then aggregated to 5-min (retained 63 days)
  - Then aggregated to 1-hour (retained 15 months)
  - Cost: Free for default metrics

High Resolution: 1-second granularity
  - Custom metrics only
  - Retained at 1-second for 3 hours
  - Then 1-minute for 15 days
  - Cost: $0.30/metric/month (1-sec resolution custom metrics are $0.02/1000 points)
```

### Statistics

CloudWatch can calculate statistics over a metric's data points:

```
Average:  Avg value over period           (CPU avg over 5 min)
Sum:      Total sum over period           (total requests in 5 min)
Minimum:  Lowest value in period          (min response time)
Maximum:  Highest value in period         (peak CPU)
SampleCount: Number of data points

Percentiles (p50, p90, p95, p99, p99.9):
  p50 = median: half of requests are faster, half slower
  p99 = 99th percentile: 99% of requests are faster than this
  p99.9 = 99.9th percentile: most important for tail latency

Example:
  Request latencies: 10ms, 12ms, 11ms, 9ms, 500ms, 11ms, 10ms
  Average: ~80ms  (misleading due to outlier!)
  p99: ~500ms    (shows the real tail latency problem)
  
Always use percentiles for latency metrics!
```

---

## 3. CloudWatch Alarms

A **CloudWatch Alarm** watches a single metric and performs one or more actions when the metric crosses a threshold.

### Alarm States

```
+------------------+
|   INSUFFICIENT   |  Not enough data to evaluate
|     DATA         |  (new metric, not enough data points)
+------------------+
         |
    (data arrives)
         |
         v
+------------------+
|       OK         |  Metric is within threshold
|                  |  Everything is fine
+------------------+
         |
    (threshold crossed)
         |
         v
+------------------+
|     ALARM        |  Metric has breached threshold
|                  |  Actions triggered
+------------------+
```

### Creating an Alarm (Console)

```
CloudWatch Console -> Alarms -> Create Alarm

Step 1: Select Metric
  Namespace: AWS/EC2
  MetricName: CPUUtilization
  Dimension: InstanceId = i-0123456789
  Statistic: Average
  Period: 5 minutes

Step 2: Define Threshold
  Threshold type: Static
  Whenever CPUUtilization is: Greater than 80 (percent)
  Datapoints to alarm: 3 out of 3
    (must be above 80% for 3 consecutive 5-min periods = 15 min)

Step 3: Configure Actions
  Alarm state trigger: In Alarm
  Action: Send notification to SNS topic
  SNS topic: prod-alerts (sends email)
  
  Also configure: OK state notification (recovery alert)

Step 4: Name and Create
  Alarm name: EC2-High-CPU-i-0123456789
  -> Create alarm
```

### Alarm Actions

**SNS Notification:**
```
Alarm -> SNS Topic -> Email subscribers
                   -> Lambda function
                   -> HTTP endpoint (webhook)
                   -> PagerDuty, Slack (via Lambda)
```

**Auto Scaling Action:**
```
Alarm (CPU > 70%) -> Add 2 EC2 instances to ASG
Alarm (CPU < 30%) -> Remove 1 EC2 instance from ASG
```

**EC2 Actions:**
```
Alarm (StatusCheckFailed) -> Stop instance
                          -> Terminate instance
                          -> Reboot instance
                          -> Recover instance (to new host)
```

**Systems Manager (SSM) Action:**
```
Alarm -> Run SSM Automation document
       (take snapshot, run script, etc.)
```

### Composite Alarms

A **Composite Alarm** combines multiple alarms using boolean logic:

```
ALARM_NAME = "AppTotallyDown"
ALARM_RULE = ALARM(EC2-Down) AND ALARM(RDS-Down)

Action: Only page on-call engineer if BOTH are down
        (not just because EC2 high CPU)

Or:
ALARM_RULE = ALARM(HighCPU) OR ALARM(HighMemory) OR ALARM(DiskFull)
```

Composite alarms reduce alert noise (alarm storms).

### Billing Alarm

Set up a billing alarm to get notified when AWS charges exceed a threshold:

```
Step 1: Enable billing alerts
  Billing Console -> Billing Preferences
  -> Receive Billing Alerts -> Save preferences

Step 2: Create alarm
  CloudWatch -> Alarms -> Create Alarm
  Namespace: AWS/Billing
  Metric: EstimatedCharges
  Statistic: Maximum
  Period: 6 hours
  Threshold: Greater than $100 (USD)
  Action: SNS email notification

Note: Billing metrics are only available in us-east-1!
```

### Alarm Math and Anomaly Detection

**Metric Math:**
Create new metrics from existing ones:

```
Example: Error Rate = Errors / Requests * 100

m1 = AWS/ApplicationELB HTTPCode_Target_5XX_Count
m2 = AWS/ApplicationELB RequestCount
Expression: (m1/m2)*100

Alarm on this calculated error rate instead of raw count
```

**Anomaly Detection:**
Uses ML to predict expected metric range:

```
CloudWatch learns your metric's pattern
Creates a band of expected values (dynamically adjusts for time-of-day, day-of-week)

Alarm if metric goes outside the band:
  UPPER band breach: Higher than expected
  LOWER band breach: Lower than expected

Example: website traffic lower than expected at 2pm on Tuesday
         -> investigate outage
```

### Alarm Best Practices

```
1. Set meaningful thresholds (not too sensitive, not too loose)
   - CPU alarm: 80% for 15 minutes (not instantly at 80%)
   
2. Use percentiles for latency:
   - p99 latency > 2 seconds -> alarm
   
3. Alert on what matters to customers:
   - Error rate > 1% -> alarm
   - Not: disk I/O > X (leading indicator, set as warning)

4. Set up recovery notifications (OK state):
   - Know when issues resolve

5. Composite alarms to reduce noise:
   - Only wake on-call when multiple signals indicate real outage

6. Action per alarm state:
   - ALARM: Alert engineering
   - OK: Send all-clear notification
   - INSUFFICIENT_DATA: Investigate if metric collection stopped
```

---

## 4. CloudWatch Logs

**CloudWatch Logs** enables you to centralize, monitor, and store log files from AWS services, EC2 instances, and on-premises servers.

### Log Hierarchy

```
Log Group: /aws/lambda/my-function
  |
  +-- Log Stream: 2024/01/15/[$LATEST]abcdef123
  |     2024-01-15T10:00:00Z START RequestId: abc123
  |     2024-01-15T10:00:01Z INFO Processing order #12345
  |     2024-01-15T10:00:01Z END RequestId: abc123
  |
  +-- Log Stream: 2024/01/15/[$LATEST]ghijkl456
        2024-01-15T10:05:00Z START RequestId: def456
        2024-01-15T10:05:02Z ERROR Payment failed: timeout
        2024-01-15T10:05:02Z END RequestId: def456
```

**Log Group:**
- Container for log streams
- Define retention period here
- Apply metric filters here
- Example: `/aws/lambda/my-function`, `/var/log/messages`

**Log Stream:**
- Sequence of log events from the same source
- One log stream per log source (one per Lambda container, one per EC2 instance)

### Automatic Log Sending

These services send logs to CloudWatch Logs automatically:

```
Lambda         -> /aws/lambda/<function-name>
API Gateway    -> /aws/api-gateway/<api-name>
ECS/Fargate    -> /ecs/<cluster-name>
CloudTrail     -> /aws/cloudtrail (optional)
VPC Flow Logs  -> /aws/vpc/flowlogs (if configured)
Route53        -> /aws/route53/<hosted-zone-id>
```

### Log Retention

By default, CloudWatch Logs are stored **indefinitely**. You should set retention to control costs:

```
Log Group Settings -> Retention Setting:
  1 day
  3 days
  5 days
  1 week
  2 weeks
  1 month
  2 months
  3 months
  6 months
  1 year
  13 months
  18 months
  2 years
  5 years
  10 years
  Never expire (default)
```

**Cost consideration:**
- Ingestion: $0.50/GB
- Storage: $0.03/GB/month
- For high-volume logs (10 GB/day), set retention to match your needs

### Log Groups Naming Conventions

```
AWS-managed (you don't control):
  /aws/lambda/<function-name>
  /aws/ecs/cluster/<cluster-name>

You control:
  /application/<app-name>/<environment>   (e.g., /application/payments/prod)
  /system/<type>/<hostname>               (e.g., /system/syslog/web-server-01)
  /security/vpc-flow-logs                 (meaningful names)
```

### Exporting Logs

**To S3 (batch export):**
```
Log Group -> Actions -> Export data to Amazon S3
Time range: select
S3 bucket: your-log-archive-bucket
S3 prefix: cloudwatch-logs/my-app/

Note: Export is not real-time (up to 12 hours delay)
      For real-time, use Kinesis Data Firehose subscription
```

**Real-time to S3/Elasticsearch/Splunk:**
```
Log Group -> Subscription Filters -> Create
  -> Kinesis Data Firehose -> S3 (real-time streaming)
  -> Kinesis Data Stream -> Lambda (real-time processing)
  -> Elasticsearch/OpenSearch Service (log analytics)
```

---

## 5. CloudWatch Logs Insights

**Logs Insights** is a fast, interactive query service for CloudWatch Logs.

### Query Language

```
Basic syntax:
  fields @timestamp, @message
  | filter @message like /ERROR/
  | sort @timestamp desc
  | limit 20
```

### Query Commands

```
fields    - Select/add/compute fields
filter    - Filter events
stats     - Aggregate (count, sum, avg, min, max)
sort      - Sort results
limit     - Limit number of results
parse     - Extract fields from log text
```

### Practical Query Examples

**Find all errors in the last hour:**
```
fields @timestamp, @message, @logStream
| filter @message like /ERROR|Exception|error/
| sort @timestamp desc
| limit 100
```

**Lambda function error rate:**
```
filter @type = "REPORT"
| stats count(*) as total,
        sum(@duration > 3000) as slowRequests,
        count(@message like /ERROR/) as errors
| project errorRate = errors/total*100,
          slowRate = slowRequests/total*100
```

**Lambda cold starts:**
```
filter @message like /Init Duration/
| parse @message "Init Duration: * ms" as initDuration
| stats count() as coldStarts,
        avg(initDuration) as avgInitDuration,
        max(initDuration) as maxInitDuration
```

**ALB 5xx errors by URL:**
```
fields @timestamp, request_url, status
| filter status >= 500
| stats count(*) as error_count by request_url
| sort error_count desc
| limit 20
```

**VPC Flow Logs: Top talkers (most bytes sent):**
```
fields srcAddr, dstAddr, bytes
| stats sum(bytes) as totalBytes by srcAddr
| sort totalBytes desc
| limit 10
```

**Find requests from specific IP:**
```
fields @timestamp, @message
| filter @message like /192.168.1.100/
| sort @timestamp desc
```

**P99 latency over time (for ALB logs):**
```
fields @timestamp, targetProcessingTime
| filter targetProcessingTime > 0
| stats pct(targetProcessingTime, 99) as p99Latency by bin(5min)
| sort @timestamp desc
```

### Visualizing Query Results

Logs Insights can generate visualizations:

```
Bar chart: Count by status code
  fields status
  | stats count(*) by status
  -> Bar chart showing distribution of status codes

Time series: Error count per minute
  filter @message like /ERROR/
  | stats count(*) by bin(1min)
  -> Line chart of errors over time
```

### Saving Queries

```
Logs Insights -> Run a query -> Actions -> Save query
Name: "Production Lambda Errors"
Description: "Shows errors in last hour"

Saved queries appear in the query history panel
Can be run in future without retyping
```

---

## 6. Metric Filters

**Metric Filters** allow you to turn log data into CloudWatch metrics — extract a numeric value from a log pattern.

### How Metric Filters Work

```
Log Stream:
  "ERROR: Payment failed for user 12345"
  "INFO: User logged in"
  "ERROR: Database connection timeout"
  "INFO: Order processed"

Metric Filter:
  Pattern: [level=ERROR, ...]
  Metric name: AppErrors
  Metric value: 1 (increment by 1 each match)
  Namespace: MyApp/Errors

Result:
  Every ERROR log line increments the AppErrors metric by 1
  You can alarm on AppErrors > 10 in 5 minutes
```

### Creating a Metric Filter

```
CloudWatch Console -> Log Groups -> Select group
-> Metric Filters -> Create metric filter

Filter pattern:  [ip, id, user, timestamp, request, status_code=5*, size]
  (matches access log lines where status code starts with 5)

Test pattern against sample logs to verify

Metric details:
  Namespace: MyWebApp/HTTP
  Metric name: 5xxErrors
  Metric value: 1
  Default value: 0 (emit 0 when no matches, for alarms)
  Unit: Count

-> Create filter
```

### Filter Pattern Syntax

**Simple string matching:**
```
"ERROR"                     <- contains ERROR
"ERROR" "payment"           <- contains both ERROR and payment
"ERROR" -"test"             <- contains ERROR but not test
```

**JSON pattern matching:**
```
{ $.level = "ERROR" }                        <- JSON log with level field
{ $.level = "ERROR" && $.latency > 1000 }    <- multiple conditions
{ $.statusCode = 5* }                        <- wildcard on status code
```

**Space-delimited (Apache/nginx log format):**
```
[host, id, username, timestamp, request, statusCode = 5*, size]
              ^^^                          ^^^^^^^^^^^
              capture groups              filter condition
```

### Common Metric Filters

```
HTTP 5xx errors:
  Pattern: [ip, id, user, time, method, url, protocol, status=5*, bytes]
  Metric: HTTP5xxErrors

Application exceptions:
  Pattern: "Exception" OR "Error" OR "FATAL"
  Metric: AppExceptions

Successful logins:
  Pattern: { $.event = "LOGIN" && $.result = "SUCCESS" }
  Metric: SuccessfulLogins

Failed logins:
  Pattern: { $.event = "LOGIN" && $.result = "FAILURE" }
  Metric: FailedLogins

Payment processing time (from structured JSON logs):
  Pattern: { $.event = "PAYMENT_PROCESSED" }
  Metric name: PaymentDuration
  Metric value: $.processingTimeMs  <- extract value from log!
```

---

## 7. CloudWatch Agent

The **CloudWatch Agent** collects system-level metrics and custom logs from EC2 instances and on-premises servers.

### What the Agent Collects

**System Metrics (not available without agent):**
```
Memory:
  mem_used_percent
  mem_used
  mem_available
  mem_total

Disk:
  disk_used_percent
  disk_used
  disk_free
  disk_total
  (per mount point)

Network:
  net_bytes_sent
  net_bytes_recv
  net_packets_sent
  net_packets_recv

Process:
  processes_running
  processes_sleeping
  processes_total
```

**Log Files:**
```
/var/log/messages
/var/log/secure
/var/log/nginx/access.log
/var/log/nginx/error.log
/var/log/httpd/access_log
Application-specific log files
Windows Event Logs
```

### Installing CloudWatch Agent

**Method 1: SSM (recommended)**
```bash
# Via Systems Manager Run Command:
aws ssm send-command \
  --document-name "AWS-ConfigureAWSPackage" \
  --parameters action=Install,name=AmazonCloudWatchAgent \
  --targets Key=tag:Environment,Values=Production
```

**Method 2: Manual installation on Amazon Linux 2**
```bash
# Download and install
sudo yum install amazon-cloudwatch-agent -y

# Create configuration using wizard
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-config-wizard

# Or create config file manually at:
# /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json

# Start agent
sudo systemctl start amazon-cloudwatch-agent
sudo systemctl enable amazon-cloudwatch-agent
```

### CloudWatch Agent Configuration

```json
{
  "agent": {
    "metrics_collection_interval": 60,
    "run_as_user": "cwagent"
  },
  "metrics": {
    "namespace": "MyApp/EC2",
    "metrics_collected": {
      "mem": {
        "measurement": ["mem_used_percent", "mem_available_percent"],
        "metrics_collection_interval": 60
      },
      "disk": {
        "measurement": ["disk_used_percent", "disk_free"],
        "resources": ["/", "/var"],
        "metrics_collection_interval": 60
      },
      "cpu": {
        "measurement": ["cpu_usage_user", "cpu_usage_system"],
        "totalcpu": true
      }
    }
  },
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/messages",
            "log_group_name": "/ec2/system/messages",
            "log_stream_name": "{instance_id}",
            "timestamp_format": "%b %d %H:%M:%S"
          },
          {
            "file_path": "/var/log/nginx/access.log",
            "log_group_name": "/ec2/nginx/access",
            "log_stream_name": "{instance_id}",
            "timestamp_format": "%d/%b/%Y:%H:%M:%S %z"
          },
          {
            "file_path": "/app/logs/application.log",
            "log_group_name": "/application/myapp/prod",
            "log_stream_name": "{instance_id}/{hostname}"
          }
        ]
      }
    }
  }
}
```

**Store config in SSM Parameter Store:**
```bash
aws ssm put-parameter \
  --name "/cloudwatch-agent/config/myapp" \
  --type String \
  --value file://cloudwatch-agent-config.json

# Apply from parameter store:
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config \
  -m ec2 \
  -s \
  -c ssm:/cloudwatch-agent/config/myapp
```

### Required IAM Permissions for CloudWatch Agent

```json
{
  "Effect": "Allow",
  "Action": [
    "cloudwatch:PutMetricData",
    "logs:CreateLogGroup",
    "logs:CreateLogStream",
    "logs:PutLogEvents",
    "logs:DescribeLogStreams"
  ],
  "Resource": "*"
}
```

Attach the AWS managed policy `CloudWatchAgentServerPolicy` to the EC2 instance role.

---

## 8. CloudWatch Dashboards

**Dashboards** are customizable home pages in CloudWatch that you can use to monitor your resources in a single view.

### Dashboard Types

**Pre-built (Automatic Dashboards):**
- Created automatically for each AWS service
- EC2 -> Automatic Dashboard shows all EC2 instances
- No setup required
- Limited customization

**Custom Dashboards:**
- You create and arrange widgets
- Cross-account and cross-region support
- Share with your team
- Saved and persistent

### Widget Types

```
Line graph:   Time-series metrics over time
              Best for: CPU trends, request rates, error rates

Number widget: Single current value
               Best for: Error count, active connections, queue depth

Bar chart:    Compare multiple values
              Best for: Requests per region, resources per type

Gauge:        Single value vs threshold
              Best for: CPU%, memory%, disk%

Text:         Markdown text
              Best for: Headers, links, notes

Alarm status: Shows alarm state (green/yellow/red)
              Best for: Operations overview page

Logs:         Embedded Logs Insights query results
              Best for: Recent errors, log tails

Explorer:     Flexible widget for exploring metrics across resources
```

### Creating a Dashboard

```
CloudWatch Console -> Dashboards -> Create Dashboard
Name: production-overview

Add widgets:
1. CPU across all production EC2:
   Widget type: Line
   Metrics: AWS/EC2 CPUUtilization
   Filter: Tag: Environment = Production
   
2. ALB Request Count:
   Widget type: Line
   Metrics: AWS/ApplicationELB RequestCount
   
3. ALB Error Rate:
   Widget type: Line
   Metric Math: (5xx / total) * 100
   
4. Current Alarm States:
   Widget type: Alarm status
   Select relevant alarms
   
5. Recent Application Errors:
   Widget type: Logs table
   Query: filter @message like /ERROR/ | limit 20
   Log group: /application/myapp/prod
```

### Cross-Region Dashboards

```
Dashboard can include metrics from multiple regions:
  - us-east-1 API metrics
  - eu-west-1 API metrics
  - ap-southeast-1 API metrics

All on one dashboard for global visibility

Go to Dashboard -> Add to Dashboard -> Switch region in metric selector
```

### Dashboard Sharing

```
CloudWatch -> Dashboards -> Select dashboard -> Share dashboard

Options:
  Share in your account     - Accessible to IAM users/roles with permission
  Share externally          - Creates public URL (anyone can view, no login)
  Share across accounts     - Requires cross-account access setup

Public sharing creates a snapshot view that updates every minute
Good for: executive dashboards, NOC screens, status pages
```

---

## 9. CloudWatch Events and EventBridge

**Amazon EventBridge** (formerly CloudWatch Events) is a serverless event bus that connects AWS services and applications.

### Event-Driven Architecture

```
Event Source                   EventBridge               Target
-----------                    -----------               ------
EC2 state change    ---event--> Rule: match  ---route--> Lambda function
IAM login                       pattern      
S3 object created                            ---route--> SNS notification
RDS snapshot                                 ---route--> Step Functions
CloudTrail event                             ---route--> SQS queue
Custom events                                ---route--> Another AWS service
```

### Rule Patterns

**Event pattern matching:**
```json
{
  "source": ["aws.ec2"],
  "detail-type": ["EC2 Instance State-change Notification"],
  "detail": {
    "state": ["terminated"]
  }
}
```

Matches when any EC2 instance is terminated.

**Scheduled rules (cron):**
```
Rate: rate(5 minutes)   - Every 5 minutes
Cron: cron(0 12 * * ? *) - Every day at 12pm UTC
```

### Common Use Cases

```
Automation triggers:
  EC2 terminated -> Lambda logs/alerts/cleanup
  S3 file uploaded -> Lambda processes file
  RDS snapshot complete -> notify operations team

Security responses:
  Root login detected (via CloudTrail) -> page security team
  Security group changed -> Lambda rolls back change

Scheduled tasks:
  Every day at 2am -> Lambda runs database maintenance
  Every hour -> Lambda checks and terminates unused instances
  First of month -> Lambda generates billing report
```

---

## 10. Container Insights

**Container Insights** collects, aggregates, and summarizes metrics and logs from containerized applications on ECS and EKS.

### What It Monitors

**ECS Metrics:**
```
Task level:
  CpuUtilized
  CpuReserved
  MemoryUtilized
  MemoryReserved
  NetworkRxBytes
  NetworkTxBytes

Service level:
  RunningTaskCount
  DesiredTaskCount
  PendingTaskCount

Container level:
  cpu_usage_total
  memory_usage
  network_rx_bytes
```

**EKS Metrics:**
```
Pod level:    cpu, memory, network per pod
Node level:   cpu, memory, disk per node
Namespace:    aggregated by Kubernetes namespace
Cluster:      overall cluster health
```

### Enabling Container Insights

**ECS:**
```
ECS Console -> Cluster -> Settings -> Container Insights: Enabled

Or via CLI:
aws ecs update-cluster-settings \
  --cluster my-cluster \
  --settings name=containerInsights,value=enabled
```

**EKS:**
```bash
# Install CloudWatch agent as DaemonSet
kubectl apply -f https://raw.githubusercontent.com/aws-samples/amazon-cloudwatch-container-insights/latest/k8s-deployment-manifest-templates/deployment-mode/daemonset/container-insights-monitoring/quickstart/cwagent-fluent-bit-quickstart.yaml
```

---

## 11. Application Insights

**CloudWatch Application Insights** automatically detects and analyzes problems in your .NET and SQL Server applications.

### What it does

```
1. Discover application components (EC2, RDS, ELB, etc.)
2. Configure monitoring automatically
3. Collect relevant metrics and logs
4. Detect anomalies using ML
5. Correlate events into problems
6. Surface in CloudWatch console
```

Useful for teams without deep monitoring expertise — reduces setup time significantly.

---

## 12. CloudWatch Pricing

### Metrics
```
Default metrics (AWS services): Free
Custom metrics:
  Standard resolution (1 min): $0.30/metric/month (first 10,000)
  High resolution (1 sec):    $0.30/metric/month

Metric API calls:
  GetMetricData: $0.01/1000 metrics requested
  PutMetricData: $0.02/1000 metrics put
```

### Logs
```
Log ingestion:
  $0.50/GB ingested

Log storage:
  $0.03/GB/month

Log Insights queries:
  $0.005/GB data scanned

Log export to S3:
  $0.001/1000 log events exported
```

### Alarms
```
Standard resolution: $0.10/alarm/month
High resolution:     $0.30/alarm/month
Composite alarms:    $0.50/alarm/month
```

### Dashboards
```
3 dashboards free (3 metrics each)
$3/dashboard/month after free tier
```

---

## 13. Hands-on Labs

### Lab 1: Billing Alarm

```
Step 1: Enable billing alerts (only needs to be done once per account)
  Billing Dashboard -> Billing Preferences
  -> Receive Billing Alerts -> Save preferences

Step 2: Create SNS topic for billing alerts
  SNS -> Topics -> Create topic
  Type: Standard
  Name: billing-alerts
  -> Create topic
  
  Subscriptions -> Create subscription
  Protocol: Email
  Endpoint: your@email.com
  -> Create -> Confirm email

Step 3: Create CloudWatch billing alarm
  IMPORTANT: Switch to us-east-1 region!
  CloudWatch -> Alarms -> Create Alarm
  
  Select Metric:
    Namespace: AWS/Billing
    Metric: EstimatedCharges
    Currency: USD
    -> Select metric
    Statistic: Maximum
    Period: 6 hours
  
  Conditions:
    Greater than $50 (or your threshold)
  
  Notification:
    In Alarm -> SNS -> billing-alerts
    
  Name: MonthlyBillingAlarm-50USD
  -> Create alarm

Test: The alarm starts in INSUFFICIENT_DATA until next billing metric is sent
```

### Lab 2: Monitor EC2 CPU with Alarm + Email

```
Step 1: Launch EC2 instance with monitoring

Step 2: Create SNS topic for ops alerts
  SNS -> Create topic: ops-alerts
  Subscribe your email

Step 3: Create CPU alarm
  CloudWatch -> Alarms -> Create Alarm
  
  Metric:
    AWS/EC2 -> Per-Instance Metrics
    CPUUtilization -> your instance
    Statistic: Average
    Period: 5 minutes
  
  Threshold: > 80%
  Datapoints: 3 out of 3 (15 minutes of high CPU)
  
  Actions (In alarm): sns-ops-alerts
  Actions (OK): sns-ops-alerts (recovery notification)
  
  Name: EC2-CPU-High

Step 4: Trigger the alarm (stress test)
  SSH to EC2:
  sudo yum install -y stress
  stress --cpu 4 --timeout 1200   # 20 minutes of high CPU
  
  Watch alarm transition: OK -> ALARM (after ~15 min)
  Receive email notification
  
  Stop stress, alarm goes back to OK -> receive recovery email
```

### Lab 3: Lambda Error Monitoring with Logs Insights

```
Step 1: Create test Lambda function (Python)
  import json
  import random
  
  def lambda_handler(event, context):
      if random.random() < 0.3:  # 30% failure rate
          raise Exception("Simulated error!")
      return {"statusCode": 200}

Step 2: Invoke Lambda multiple times
  aws lambda invoke --function-name my-test-fn output.txt --count 20

Step 3: Query errors with Logs Insights
  CloudWatch -> Logs Insights
  Log Group: /aws/lambda/my-test-fn
  Time range: Last 30 minutes
  
  Query:
    filter @message like /ERROR/
    | fields @timestamp, @message
    | sort @timestamp desc
  
  -> Run query

Step 4: Create metric filter
  Log Groups -> /aws/lambda/my-test-fn
  -> Metric Filters -> Create
  Pattern: "ERROR"
  Metric: LambdaErrors
  Namespace: MyApp/Lambda
  
Step 5: Create alarm on Lambda errors
  Alarm on LambdaErrors > 5 in 10 minutes
```

---

## 14. Interview Q&A

**Q1: What is the difference between CloudWatch Metrics and CloudWatch Logs?**

A: 
- **Metrics** are numerical time-series data (CPU percentage, request count, latency). They are aggregated, stored efficiently for long periods, and used for graphing and alarming.
- **Logs** are text-based records of events (application logs, system logs, API call records). They contain full context about what happened and support full-text search and queries.

---

**Q2: Why would you use p99 latency instead of average latency for alarms?**

A: Average latency can hide severe outliers. If 99% of requests complete in 50ms but 1% take 10 seconds, the average might look fine (~150ms). The p99 would show 10 seconds, revealing the real user experience problem for 1% of users. Always use percentiles for latency metrics — average is misleading for skewed distributions.

---

**Q3: What metrics does CloudWatch NOT collect from EC2 by default?**

A: Memory utilization, disk space, swap usage, and per-process metrics. These require the **CloudWatch Agent** because AWS's hypervisor cannot see inside the operating system. The hypervisor can only see CPU cycles, network bytes (from virtual NIC), and EBS I/O — all external to the OS.

---

**Q4: What are the three states of a CloudWatch Alarm and what triggers each?**

A:
- **OK**: Metric is within the defined threshold
- **ALARM**: Metric has breached the threshold for the configured number of evaluation periods
- **INSUFFICIENT_DATA**: Not enough data to evaluate (new metric, stopped metric collection, or evaluation period too short)

---

**Q5: How would you alert on errors in application logs?**

A: Use a **Metric Filter**:
1. Create a filter on the CloudWatch Logs log group with a pattern matching your error logs
2. Emit a metric (e.g., `AppErrors`) with value 1 for each match
3. Create a CloudWatch Alarm on the `AppErrors` metric
4. Configure the alarm to notify an SNS topic (email/PagerDuty)

---

**Q6: What is the difference between CloudWatch Events and EventBridge?**

A: EventBridge is the evolution of CloudWatch Events. They share the same underlying infrastructure. EventBridge adds: custom event buses, schema registry, third-party SaaS event sources, and better filtering. AWS is directing all new development to EventBridge and CloudWatch Events will eventually be deprecated. For new development, always use EventBridge.

---

**Q7: How do you monitor memory on EC2 instances?**

A: Install the **CloudWatch Agent** on the EC2 instance. The agent runs inside the OS and can measure:
1. `mem_used_percent`
2. `mem_available_percent`
3. `mem_total`

Configure the agent's JSON config file to collect these metrics, then start the agent. The metrics appear in CloudWatch under your configured namespace. Ensure the EC2 instance role has the `CloudWatchAgentServerPolicy` IAM policy attached.

---

**Q8: What is a Composite Alarm and why is it useful?**

A: A Composite Alarm combines multiple alarms using AND/OR/NOT logic. It's useful for reducing alert noise. Instead of receiving alerts for every individual metric spike, you define that you only want to be paged when multiple signals indicate a real outage (e.g., ALARM if CPU > 90% AND error rate > 5% AND latency > 2s). This reduces false positives that wake on-call engineers unnecessarily.

---

**Q9: How do you query CloudWatch Logs across multiple log groups?**

A: In CloudWatch Logs Insights, you can query multiple log groups by:
1. Selecting multiple log groups in the query editor (hold Ctrl/Cmd to select multiple)
2. Using a prefix pattern if log groups share a naming convention

Alternatively, you can stream logs from multiple groups to a central location (Kinesis, OpenSearch) for cross-group analytics.

---

**Q10: CloudWatch alarm datapoints-to-alarm setting: what is "3 out of 5"?**

A: It means the alarm triggers when 3 of the last 5 evaluation periods breach the threshold. This reduces false alarms from brief spikes. 
- **3 out of 3**: Alarm only after 3 consecutive periods breach — good for sustained issues, slow to alarm
- **1 out of 1**: Alarm immediately on first breach — fast but more false positives
- **3 out of 5**: Middle ground — 3 breaches in last 5 periods, tolerates 2 brief spikes

---

**Q11: How would you set up a CloudWatch dashboard to share with executives?**

A: 
1. Create a CloudWatch Dashboard with business-relevant metrics (revenue metrics, error rates, response times, not raw CPU/memory)
2. Use number widgets for current values and line charts for trends
3. Use the Dashboard Sharing feature to create a public URL or share with specific IAM users
4. Consider embedding in an internal portal
5. Use meaningful widget titles and add text widgets explaining what each metric means

---

*End of CloudWatch Complete Guide*
