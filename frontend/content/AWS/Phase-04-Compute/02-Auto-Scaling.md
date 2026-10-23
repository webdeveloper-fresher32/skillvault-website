# Auto Scaling — The Complete Guide

## Table of Contents

1. [What is Auto Scaling and Why It's Needed](#1-what-is-auto-scaling-and-why-its-needed)
2. [Manual vs Automatic Scaling](#2-manual-vs-automatic-scaling)
3. [Auto Scaling Group (ASG)](#3-auto-scaling-group-asg)
4. [Launch Template vs Launch Configuration](#4-launch-template-vs-launch-configuration)
5. [Scaling Policies](#5-scaling-policies)
6. [Cooldown Period](#6-cooldown-period)
7. [Health Checks](#7-health-checks)
8. [Instance Refresh](#8-instance-refresh)
9. [Lifecycle Hooks](#9-lifecycle-hooks)
10. [Hands-On: Create ASG with ALB](#10-hands-on-create-asg-with-alb)
11. [Interview Q&A](#11-interview-qa)

---

## 1. What is Auto Scaling and Why It's Needed

### The Problem: Static Capacity

Imagine you run an e-commerce platform. Your traffic looks like this:

```
Traffic (requests/sec)
   |
500|              █████
   |             ██   ██
300|            ██     ██
   |           ██       ██
100|███████████           ████████████
   |
   └─────────────────────────────────────> Time
   6am         12pm        6pm       12am
```

If you provision for **peak traffic (500 req/s)**:
- You waste money running 5x the capacity you need at off-peak times
- Servers sit idle 80% of the time

If you provision for **average traffic (100 req/s)**:
- Peak traffic overwhelms your servers
- Users get slow responses or errors
- You lose revenue and reputation

### The Solution: Auto Scaling

Auto Scaling automatically adjusts the number of EC2 instances to match current demand.

```
With Auto Scaling:
   |
5 instances       ┌───────────┐
                  │  3 inst   │
3 instances     ┌─┘           └─┐
                │               │
1 instance  ────┘               └────
   |
   └─────────────────────────────────> Time
   6am         12pm        6pm       12am
```

**Benefits:**
- Cost efficiency: Run only what you need
- High availability: Replace unhealthy instances automatically
- Better performance: Add capacity before you get overwhelmed
- Zero downtime deployments (rolling updates)

---

## 2. Manual vs Automatic Scaling

### Manual Scaling

You decide when to add or remove instances.

```
# AWS CLI — manually set desired capacity
aws autoscaling set-desired-capacity \
  --auto-scaling-group-name my-asg \
  --desired-capacity 5
```

Use for: Predictable events where you know in advance (Black Friday, planned maintenance).

### Automatic Scaling

AWS monitors metrics and adjusts capacity based on rules you define.

```
Monitor: CPU utilization > 70% for 5 minutes
Action:  Add 2 instances

Monitor: CPU utilization < 30% for 10 minutes
Action:  Remove 1 instance
```

---

## 3. Auto Scaling Group (ASG)

### What is an ASG?

An Auto Scaling Group is a **logical grouping of EC2 instances** that are managed together.
The ASG ensures you always have the right number of healthy instances running.

### Core Parameters

```
Auto Scaling Group
┌──────────────────────────────────────────────────┐
│                                                   │
│  Minimum Capacity:  2   ← Never go below this    │
│  Desired Capacity:  4   ← Target number right now│
│  Maximum Capacity:  10  ← Never exceed this      │
│                                                   │
│  Current instances: [i-001] [i-002] [i-003] [i-004]│
│                                                   │
└──────────────────────────────────────────────────┘
```

- **Minimum**: The floor. ASG will never reduce below this (HA guarantee).
- **Maximum**: The ceiling. ASG will never add beyond this (cost guard).
- **Desired**: The current target. ASG adjusts to match this.
  - Scaling policies change the desired capacity.
  - ASG launches/terminates instances to reach desired.

### Multi-AZ Deployment

Always deploy an ASG across **multiple Availability Zones** for high availability.

```
Region: us-east-1
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  AZ: us-east-1a          AZ: us-east-1b                 │
│  ┌────────────────┐      ┌────────────────┐             │
│  │  [EC2] [EC2]   │      │  [EC2] [EC2]   │             │
│  └────────────────┘      └────────────────┘             │
│                                                         │
│  ASG distributes instances evenly across AZs            │
│  If one AZ goes down, instances in other AZs survive    │
└─────────────────────────────────────────────────────────┘
```

ASG uses a **rebalancing** mechanism — if one AZ has more instances than another after a
termination, ASG will launch in the under-represented AZ to balance.

### ASG Configuration Summary

| Setting | Description |
|---------|-------------|
| Launch Template | What kind of instance to launch |
| VPC + Subnets | Where to place instances (use multiple AZs) |
| Load Balancer | Automatically registers/deregisters instances |
| Health check type | EC2 or ELB health checks |
| Health check grace period | Wait time before checking health on new instances |
| Scaling policies | When and how to scale |
| Termination policy | Which instance to remove when scaling in |

### Termination Policy

When scaling in (removing instances), ASG follows a termination policy to choose which
instance to terminate:

1. **Default**: Remove instance in AZ with most instances, then oldest Launch Template,
   then instance closest to the next billing hour
2. **OldestInstance**: Terminates the oldest instance first (good for rolling updates)
3. **NewestInstance**: Terminates the newest instance first
4. **OldestLaunchTemplate**: Terminates instances using the oldest launch template
5. **ClosestToNextInstanceHour**: Minimize billing waste

---

## 4. Launch Template vs Launch Configuration

Before an ASG can launch instances, it needs a blueprint. AWS has two options.

### Launch Configuration (Legacy — Do Not Use for New ASGs)

The original blueprint format. Simple but limited.
- Cannot be modified after creation (must create a new one)
- Does not support all instance features
- AWS recommends migrating to Launch Templates

### Launch Template (Current Standard)

More powerful and flexible than Launch Configurations.

```
Launch Template v1:
  AMI: ami-0abc123 (Amazon Linux 2023)
  Instance Type: t3.medium
  Key Pair: my-key-pair
  Security Group: sg-web-server
  IAM Profile: ec2-web-role
  User Data: #!/bin/bash\nyum update -y\n...
  EBS: 20 GB gp3, encrypted
  Tags: Name=web-server, Env=prod
```

**Key advantages of Launch Templates:**

- **Versioning**: Create new versions without losing old ones. ASG can use a specific version
  or "latest" or "default"
- **Mixed instances policy**: Combine multiple instance types (Spot + On-Demand mix)
- **Instance requirements**: Specify vCPU and memory ranges instead of a specific type
- **Full feature support**: T3 Unlimited, Placement Groups, Nitro features, etc.

### Creating a Launch Template

```
EC2 → Launch Templates → Create launch template

Settings:
  Name: web-server-template
  Version description: Node.js 18 + Nginx initial
  
  AMI: ami-0abc123 (Amazon Linux 2023)
  Instance type: t3.medium
  Key pair: my-key-pair
  
  Network:
    Subnet: Don't include in template (ASG controls this)
    Security groups: sg-0abc123 (web-sg)
  
  Storage:
    Volume 1: 20 GB gp3, encrypted
  
  Advanced:
    IAM instance profile: ec2-ssm-role
    User data: (paste bootstrap script)
    Detailed CloudWatch monitoring: Enable
    
→ Create launch template
```

### Updating an ASG with a New Launch Template Version

```bash
# Create new version of the template
aws ec2 create-launch-template-version \
  --launch-template-id lt-0abc123 \
  --source-version 1 \
  --launch-template-data '{"ImageId":"ami-0newami123"}'

# Update ASG to use latest version
aws autoscaling update-auto-scaling-group \
  --auto-scaling-group-name my-asg \
  --launch-template LaunchTemplateId=lt-0abc123,Version='$Latest'
```

Existing instances keep running with the old template until replaced via Instance Refresh.

---

## 5. Scaling Policies

### Overview of Policy Types

```
Scaling Policy Types:
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  1. Target Tracking    ← Most common, recommended       │
│     "Keep CPU at 50%"                                   │
│                                                         │
│  2. Step Scaling       ← More control, multiple steps   │
│     "Add 2 if CPU>70%, add 4 if CPU>90%"                │
│                                                         │
│  3. Simple Scaling     ← Legacy, single step, wait      │
│     "Add 1 if CPU>70%"                                  │
│                                                         │
│  4. Scheduled Scaling  ← Time-based                     │
│     "Add 5 instances every Friday at 9am"               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

### Target Tracking Scaling

**Concept**: You define a target metric value. AWS automatically adds or removes instances to
keep the metric at that target. Similar to a thermostat — set the temperature, thermostat does
the work.

**Example: Keep average CPU at 50%**

```
Target: 50% average CPU

Current state: 4 instances, 80% CPU
  → AWS calculates: need 4 × (80/50) = 6.4 → rounds up to 7 instances
  → Launches 3 more instances

Current state: 7 instances, 20% CPU
  → AWS calculates: need 7 × (20/50) = 2.8 → rounds up to 3 instances
  → Terminates 4 instances (respecting minimum)
```

**Common target metrics:**
- `ASGAverageCPUUtilization`: Average CPU across all instances
- `ASGAverageNetworkIn`: Average network input
- `ASGAverageNetworkOut`: Average network output
- `ALBRequestCountPerTarget`: Requests per target in a Target Group

**How to create via console:**
```
ASG → Automatic Scaling → Create scaling policy
  Policy type: Target tracking scaling
  Scaling policy name: cpu-target-50
  Metric type: Average CPU utilization
  Target value: 50
  Instance warmup: 300 seconds
  Disable scale-in: No (allow scale-in)
→ Create
```

**Scale-in disable option**: You can check "Disable scale-in" to only allow scaling out.
Useful when you want another policy (like a schedule) to control scale-in independently.

---

### Step Scaling

**Concept**: You define metric thresholds and specific step adjustments for each threshold range.
More granular control than Target Tracking.

**Example: Multi-step CPU scaling**

```
Scale-out steps:
  CPU 70-80%   → Add 1 instance
  CPU 80-90%   → Add 2 instances
  CPU > 90%    → Add 3 instances  (emergency scale-out)

Scale-in steps:
  CPU 40-50%   → Remove 1 instance
  CPU < 40%    → Remove 2 instances
```

```
                                         +3 instances
                                    ┌────────────────── CPU >90%
               +2 instances         │
          ┌────────────────── ──────┘ CPU 80-90%
+1 instance│
──────────┘ CPU 70-80%

Scale-in (symmetric):
Remove 2 instances  ──────┐ CPU <40%
                          │
Remove 1 instance ────────┘ CPU 40-50%
```

**CloudWatch Alarm required**: Step scaling requires you to create CloudWatch alarms that
trigger the policy.

```bash
# Create CloudWatch alarm for high CPU
aws cloudwatch put-metric-alarm \
  --alarm-name "high-cpu-alarm" \
  --metric-name CPUUtilization \
  --namespace AWS/EC2 \
  --statistic Average \
  --period 60 \
  --evaluation-periods 3 \
  --threshold 70 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=AutoScalingGroupName,Value=my-asg \
  --alarm-actions arn:aws:autoscaling:us-east-1:123456:scalingPolicy:...
```

**Adjustment types for Step Scaling:**
- `ChangeInCapacity`: Add or subtract an exact number (e.g., +2, -1)
- `ExactCapacity`: Set to an exact number (e.g., set to 5)
- `PercentChangeInCapacity`: Add or subtract a percentage (e.g., +30%)

---

### Simple Scaling (Legacy)

Like Step Scaling but with only one step and a mandatory wait period (cooldown) between
actions. Not recommended — use Step Scaling or Target Tracking instead.

```
Alarm fires → Scale action → Wait for cooldown → Allow next action
```

---

### Scheduled Scaling

Add or remove instances at specific times. For predictable traffic patterns.

**Examples:**
- Business hours: Scale up at 8am, scale down at 8pm on weekdays
- Weekly peaks: Scale up Friday 5pm for weekend traffic
- Known events: Scale up before a planned marketing campaign

```bash
# Scale up to 10 instances every Monday at 8am UTC
aws autoscaling put-scheduled-update-group-action \
  --auto-scaling-group-name my-asg \
  --scheduled-action-name scale-up-weekday-morning \
  --recurrence "0 8 * * 1-5" \
  --min-size 5 \
  --max-size 20 \
  --desired-capacity 10

# Scale down to 2 instances every Monday at 8pm UTC
aws autoscaling put-scheduled-update-group-action \
  --auto-scaling-group-name my-asg \
  --scheduled-action-name scale-down-weekday-evening \
  --recurrence "0 20 * * 1-5" \
  --min-size 1 \
  --max-size 20 \
  --desired-capacity 2
```

**Cron format**: `minute hour day-of-month month day-of-week`
- `0 8 * * 1-5` = 8:00am every Monday through Friday
- `30 14 * * 5` = 2:30pm every Friday
- `0 0 1 * *` = Midnight on the 1st of every month

---

### Predictive Scaling

AWS uses machine learning to analyze historical patterns and **proactively** scales before
traffic arrives (not reactive like other policies).

```
Historical pattern detected:
  Traffic spikes every weekday morning at 9am

Predictive Scaling action:
  Pre-warm instances at 8:30am (30-minute lead time)
  → Instances are ready before the traffic arrives
```

Enable alongside reactive policies for the best of both worlds.

---

## 6. Cooldown Period

### Why Cooldown is Needed

After a scaling action, new instances need time to:
1. Boot up (1-3 minutes)
2. Pass health checks
3. Start serving traffic
4. Actually impact the metrics

Without cooldown, ASG might fire another scaling action before the first one has had any effect,
causing over-scaling.

```
Without cooldown:
t=0:00  CPU=80% → Launch 2 instances
t=0:30  CPU still 80% (new instances still booting)
t=0:30  ASG fires again → Launch 2 more instances
t=1:00  CPU still 80% (all still booting)
t=1:00  ASG fires again → Launch 2 more instances
t=2:00  6 new instances all start serving → CPU drops to 10%
t=2:00  Now you have 10 instances for low load → wasted money + scale-in lag

With cooldown (300 seconds):
t=0:00  CPU=80% → Launch 2 instances → Start 300-second cooldown
t=5:00  Cooldown expires, CPU=45% → No action needed
```

### Cooldown Settings

**Default cooldown**: Applied to simple scaling policies. Default is 300 seconds (5 minutes).

**Instance warmup**: Used by Target Tracking and Step Scaling. During warmup, the instance
counts toward desired capacity but is excluded from CloudWatch metric aggregation.

```
Warmup period example:

t=0:00  Scale-out fires, launch instance
t=0:00  Instance in "warming up" state
t=5:00  Warmup period ends
t=5:00  Instance's metrics now included in ASG average CPU calculation
```

**Per-policy cooldowns**: You can set different cooldown periods for scale-out vs scale-in.
Scale-in actions typically use a longer cooldown to prevent flapping.

---

## 7. Health Checks

### EC2 Health Check (Default)

The ASG checks the EC2 instance status from the hypervisor level:
- **System Status Check**: AWS hardware/network issues (fails if underlying hardware fails)
- **Instance Status Check**: Software/OS issues (fails if OS kernel panic, networking misconfigured)

```
EC2 Health Check:
  AWS ──→ Hypervisor ──→ Is the instance running?
                        Is the OS responding?

DOES NOT CHECK:
  - Is your application running?
  - Is port 80 responding?
  - Is the app returning 200 OK?
```

If EC2 health check fails → ASG terminates and replaces the instance.

### ELB Health Check

The load balancer actively checks if your application is responding correctly.

```
ELB Health Check:
  ALB ──→ HTTP GET /health ──→ Instance
       ←── 200 OK? ──────────←

Checks:
  - Is port 80 open?
  - Does /health return 2xx?
  - Is the response within the timeout?
```

**How to enable ELB health checks in ASG:**
```
ASG → Details → Health checks
  Health check type: ELB  ← Change from EC2 to ELB
  Health check grace period: 300 seconds
```

### Health Check Grace Period

The grace period is a delay after instance launch before ASG starts health checking.

This prevents ASG from terminating new instances that are still booting/bootstrapping.

```
Without grace period:
  t=0   Instance launches
  t=30  Health check: app not responding yet (still starting)
  t=30  ASG terminates instance → Launches another
  t=60  New instance: same problem → infinite loop!

With 300-second grace period:
  t=0   Instance launches
  t=0-300  Health checks skipped
  t=300  Health check: app is running → passes
```

Set grace period to slightly longer than your longest expected startup time.

### Why ELB Health Checks Are Better

```
Scenario: Your app crashes but EC2 instance is still running

EC2 health check: PASS (instance is up)
ELB health check: FAIL (app not responding on port 80)

Result with EC2 health check: Traffic keeps going to broken instance
Result with ELB health check: ASG replaces the instance
```

Always use ELB health checks when you have a load balancer — it catches application-level
failures, not just infrastructure failures.

---

## 8. Instance Refresh

### What is Instance Refresh?

Instance Refresh lets you **rolling-replace all instances** in an ASG with minimal downtime.
Used when you update the Launch Template (new AMI, new instance type, new config).

```
Before Instance Refresh:
  [v1] [v1] [v1] [v1] [v1] [v1]

During Instance Refresh (30% min healthy):
  Step 1: [v1] [v1] [v1] [v1] [v2] [v2]
  Step 2: [v1] [v1] [v2] [v2] [v2] [v2]
  Step 3: [v2] [v2] [v2] [v2] [v2] [v2]

After Instance Refresh:
  [v2] [v2] [v2] [v2] [v2] [v2]
```

### Minimum Healthy Percentage

Controls how many instances must remain healthy during the refresh.

- **70%**: At most 30% of instances are refreshed at a time
- **50%**: Up to half can be replaced at once (faster but riskier)
- **100%**: No disruption (AWS first adds new instances, then removes old ones)

### Checkpoint Support

Instance Refresh supports checkpoints — pause the refresh at a percentage completion
to validate the new instances before proceeding.

```
Start refresh
  ↓
20% replaced → PAUSE (checkpoint)
  → Run smoke tests manually or automated
  → Resume if tests pass
  ↓
50% replaced → PAUSE (checkpoint)
  → Validate metrics
  → Resume
  ↓
100% replaced → Complete
```

### Triggering Instance Refresh

```bash
aws autoscaling start-instance-refresh \
  --auto-scaling-group-name my-asg \
  --preferences '{
    "MinHealthyPercentage": 80,
    "InstanceWarmup": 300,
    "CheckpointPercentages": [20, 50],
    "CheckpointDelay": 600
  }'
```

### Rollback

If an instance fails health checks during a refresh, you can cancel and roll back:
```bash
aws autoscaling cancel-instance-refresh \
  --auto-scaling-group-name my-asg
```

ASG will stop replacing instances. Instances that were already replaced keep the new version.
You would need to start a new refresh with the old Launch Template version to fully roll back.

---

## 9. Lifecycle Hooks

### What are Lifecycle Hooks?

Lifecycle hooks let you **pause an ASG action** and run custom code before the action completes.

```
Without Lifecycle Hooks:
  Launch: EC2 Instance ──→ Pending ──→ InService

With Lifecycle Hook on Launch:
  Launch: EC2 Instance ──→ Pending:Wait ──→ [Your code runs] ──→ InService
                                              ↑
                              You have up to 1 hour to do work here
```

### Hook Points

**Launch lifecycle**:
```
EC2 created ──→ [EC2_INSTANCE_LAUNCHING hook] ──→ Instance serves traffic
```

**Termination lifecycle**:
```
Instance targeted ──→ [EC2_INSTANCE_TERMINATING hook] ──→ Instance terminated
```

### Use Cases

**On Launch (before serving traffic):**
- Register instance with a service discovery system (Consul, Eureka)
- Pull configuration from Parameter Store or Secrets Manager
- Install monitoring agents (Datadog, New Relic)
- Run integration tests to verify the instance is healthy
- Wait for a configuration management tool (Chef, Ansible, Puppet) to converge

**On Termination (before destruction):**
- Deregister from service discovery
- Drain active connections gracefully
- Flush in-memory data to persistent storage
- Archive logs to S3
- Notify other systems that this instance is going away

### How Lifecycle Hooks Work

```
1. Instance enters Pending:Wait (or Terminating:Wait)
2. ASG sends notification to:
   - SQS queue, OR
   - SNS topic, OR
   - EventBridge event
3. Your Lambda function / script / process receives notification
4. Processes the event (deregister, flush data, etc.)
5. Sends CONTINUE or ABANDON signal back to ASG

aws autoscaling complete-lifecycle-action \
  --lifecycle-hook-name my-hook \
  --auto-scaling-group-name my-asg \
  --instance-id i-0abc123 \
  --lifecycle-action-result CONTINUE

6. ASG proceeds with launch or termination
```

### Default Wait Time

If your code does not signal back, the hook times out after the **heartbeat timeout** (default
3600 seconds = 1 hour). At timeout, the configured default result (CONTINUE or ABANDON) is used.

You can extend the timeout by sending a heartbeat:
```bash
aws autoscaling record-lifecycle-action-heartbeat \
  --lifecycle-hook-name my-hook \
  --auto-scaling-group-name my-asg \
  --instance-id i-0abc123
```

---

## 10. Hands-On: Create ASG with ALB

### Architecture Goal

```
Internet
    |
[ALB] ──> Target Group
           |        |
         [EC2-1]  [EC2-2]   ← Managed by Auto Scaling Group
         (AZ-a)   (AZ-b)
```

### Step 1: Create a Launch Template

```
EC2 → Launch Templates → Create launch template
  Name: web-asg-template
  AMI: Amazon Linux 2023 (ami-0abc123)
  Instance type: t3.micro
  Key pair: my-key-pair
  Security groups: web-sg (port 80 and 22 open)
  
  User Data:
    #!/bin/bash
    yum update -y
    yum install -y nginx
    systemctl start nginx
    systemctl enable nginx
    INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
    AZ=$(curl -s http://169.254.169.254/latest/meta-data/placement/availability-zone)
    echo "<h1>Hello from $INSTANCE_ID in $AZ</h1>" > /usr/share/nginx/html/index.html

→ Create launch template
```

### Step 2: Create Application Load Balancer

```
EC2 → Load Balancers → Create load balancer → Application Load Balancer
  Name: web-alb
  Scheme: Internet-facing
  VPC: your-vpc
  Subnets: public-subnet-a, public-subnet-b
  Security group: alb-sg (port 80 open to 0.0.0.0/0)
  
  Listeners: HTTP:80
  
  Target Group: Create new
    Name: web-targets
    Target type: Instances
    Protocol: HTTP
    Port: 80
    Health check path: /
    
→ Create load balancer
```

### Step 3: Create Auto Scaling Group

```
EC2 → Auto Scaling Groups → Create Auto Scaling group
  Name: web-asg
  Launch template: web-asg-template (Latest version)
  
  Network:
    VPC: your-vpc
    Subnets: private-subnet-a, private-subnet-b
    (or public subnets if you don't have NAT Gateway)
  
  Load balancing:
    Attach to an existing load balancer
    Choose target group: web-targets
    
  Health checks:
    Health check type: ELB
    Health check grace period: 300 seconds
  
  Group size:
    Desired: 2
    Minimum: 1
    Maximum: 5
  
  Scaling policies:
    Target tracking scaling policy
    Metric: Average CPU Utilization
    Target value: 50
    Instance warmup: 300 seconds
    
  Notifications: (optional) SNS topic for scaling events
  
  Tags: Name=web-asg-instance, Env=dev
  
→ Create Auto Scaling group
```

### Step 4: Test Auto Scaling

```bash
# Get the ALB DNS name from the console
# Test load balancing
curl http://web-alb-1234567890.us-east-1.elb.amazonaws.com
# Refresh multiple times — you should see different instance IDs

# Test scaling: SSH into one instance and simulate CPU load
ssh -i my-key.pem ec2-user@<instance-ip>
sudo yum install -y stress
stress --cpu 4 --timeout 300 &

# Watch ASG activity in the console
# EC2 → Auto Scaling Groups → web-asg → Activity tab
# You should see new instances being launched after ~5 minutes
```

### Step 5: Monitor the ASG

Key CloudWatch metrics to watch:
- `GroupDesiredCapacity`: Target number of instances
- `GroupInServiceInstances`: Actually running and healthy
- `GroupPendingInstances`: Launching but not yet in service
- `GroupTerminatingInstances`: Being terminated

```bash
# Check current ASG status via CLI
aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names web-asg \
  --query 'AutoScalingGroups[0].{
    Desired:DesiredCapacity,
    Min:MinSize,
    Max:MaxSize,
    Instances:Instances[*].{ID:InstanceId,State:LifecycleState,Health:HealthStatus}
  }'
```

---

## 11. Interview Q&A

**Q1: What is an Auto Scaling Group and what are the three key capacity settings?**
An Auto Scaling Group is a logical group of EC2 instances managed together, enabling automatic
scaling based on policies. The three key settings are:
- Minimum capacity: The floor — ASG never goes below this (ensures availability)
- Maximum capacity: The ceiling — ASG never exceeds this (cost control)
- Desired capacity: The current target — ASG always works to maintain this number

**Q2: What is the difference between a Launch Template and a Launch Configuration?**
Launch Configurations are legacy, cannot be modified after creation, and lack support for
newer features. Launch Templates support versioning (allowing rollback), mixed instance
policies (Spot + On-Demand), instance type flexibility via requirements (vCPU/memory ranges),
and all modern EC2 features. Always use Launch Templates for new ASGs.

**Q3: Explain the four types of Auto Scaling policies.**
Target Tracking: Maintain a metric at a target value (e.g., CPU at 50%). Simplest to configure,
AWS handles the math automatically. Recommended as a starting point.
Step Scaling: Define metric ranges and specific adjustment sizes for each range (e.g., CPU 70-80%
add 1, CPU >80% add 3). Good when you need precise control over scaling steps.
Simple Scaling: One threshold, one action, then mandatory cooldown. Legacy — avoid for new setups.
Scheduled Scaling: Set capacity changes at specific times. Use for predictable traffic patterns
(business hours, weekly peaks, known events).

**Q4: What is the difference between EC2 health checks and ELB health checks in an ASG?**
EC2 health checks verify the instance exists and the OS is responding at the hypervisor level.
They do NOT check if your application is functioning. ELB health checks make actual HTTP/TCP
requests to your application and verify it responds correctly (e.g., HTTP 200 on /health).
ELB health checks are preferred because they catch application-level failures, not just
infrastructure failures. Enable them by setting the health check type to "ELB" in the ASG.

**Q5: What is the Health Check Grace Period and why is it important?**
The grace period is a delay after instance launch before the ASG begins health checking the
instance. Without it, ASG would check the instance before the application has finished booting
and bootstrapping, see it fail, terminate it, and launch another in an endless loop. Set it
slightly longer than the longest expected startup time (including user data execution). Typical
values: 300 seconds for simple apps, up to 900 seconds for complex bootstrap scripts.

**Q6: What is an Instance Refresh and when would you use it?**
Instance Refresh performs a rolling replacement of all instances in an ASG, typically after
updating the Launch Template (new AMI, new instance type, new configuration). You set a minimum
healthy percentage (e.g., 80%) to control how many instances can be replaced simultaneously.
It supports checkpoints — pausing at configured percentages to validate the new instances before
proceeding. This enables zero-downtime deployments for EC2-based workloads.

**Q7: What are Lifecycle Hooks and give a real-world use case.**
Lifecycle hooks let you pause ASG actions (launching or terminating instances) to run custom
code. For launch: you might pause to register the instance with a service mesh (Consul), pull
secrets from Secrets Manager, or run integration tests. For termination: you might pause to
deregister from service discovery, drain connections gracefully, or flush in-memory data to
a database before the instance is destroyed. The hook sends an event to SQS/SNS/EventBridge,
your code processes it, then sends a CONTINUE or ABANDON signal back to the ASG.

**Q8: How does Target Tracking Scaling decide how many instances to add or remove?**
Target Tracking uses the formula: `desired instances = ceil(current instances × current metric / target metric)`.
For example, with 4 instances at 80% CPU and a target of 50%: `ceil(4 × 80/50)` = `ceil(6.4)` = 7
instances. AWS scales to 7 (adds 3). With 7 instances at 20% CPU: `ceil(7 × 20/50)` = `ceil(2.8)` = 3.
It scales to 3 (removes 4). The ceiling function ensures you always have enough capacity.

**Q9: What is the ASG cooldown period and what problem does it solve?**
The cooldown period is a wait time after a scaling action during which no new scaling actions
are taken. It solves the problem of over-scaling — without cooldown, ASG might see high CPU,
launch instances, see CPU still high (new instances still booting), launch more instances, and
repeat until hitting the maximum. The cooldown gives new instances time to boot, join the load
balancer, and actually reduce the metrics before the next action is considered.

**Q10: How would you implement a zero-downtime deployment for an ASG?**
Options:
1. Instance Refresh with 100% minimum healthy: AWS adds new instances first, then removes old ones.
   No capacity reduction, but temporarily runs double the instances.
2. Instance Refresh with ~80% minimum healthy: Rolling replacement, may briefly reduce capacity
   slightly.
3. Blue/Green deployment: Create a new ASG with the new Launch Template, put it behind the ALB's
   target group, shift traffic (via weighted target groups or DNS), then delete the old ASG.
4. Rolling update via Instance Refresh with checkpoints: Replace 20%, validate, replace 50%,
   validate, replace 100%.

**Q11: Can an ASG span multiple regions?**
No. An ASG is confined to a single region. However, it can span multiple Availability Zones
within that region, which provides high availability. For multi-region setups, you create
separate ASGs in each region and use Route 53 health checks + routing policies or Global
Accelerator to distribute traffic between regions.

**Q12: What happens when an instance in an ASG fails?**
1. The health check (EC2 or ELB) detects the failure
2. ASG marks the instance as unhealthy
3. ASG terminates the unhealthy instance
4. ASG launches a new instance to replace it (to maintain desired capacity)
5. New instance goes through the launch lifecycle (pending → warmup → in-service)
6. Load balancer registers the new instance and starts sending traffic to it
The entire process typically takes 2-5 minutes for simple applications.
