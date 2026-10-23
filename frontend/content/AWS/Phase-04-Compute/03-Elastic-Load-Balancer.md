# Elastic Load Balancer — The Complete Guide

## Table of Contents

1. [What is a Load Balancer and Why It's Needed](#1-what-is-a-load-balancer-and-why-its-needed)
2. [Types of ELB](#2-types-of-elb)
3. [ALB Deep Dive](#3-alb-deep-dive)
4. [NLB Deep Dive](#4-nlb-deep-dive)
5. [Gateway Load Balancer](#5-gateway-load-balancer)
6. [Health Checks](#6-health-checks)
7. [ALB + ASG Integration](#7-alb--asg-integration)
8. [Cross-Zone Load Balancing](#8-cross-zone-load-balancing)
9. [Access Logs](#9-access-logs)
10. [Hands-On: Create ALB with Two EC2 Instances](#10-hands-on-create-alb-with-two-ec2-instances)
11. [Interview Q&A](#11-interview-qa)

---

## 1. What is a Load Balancer and Why It's Needed

### The Problem: Single Server Bottleneck

```
Without Load Balancer:
                             ┌──────────┐
User 1 ──────────────────── >│ Server A │
User 2 ──────────────────── >│          │
User 3 ──────────────────── >│ 100% CPU │
User 4 ──────────────────── >│          │
... 1000 more users ──────── >│ OVERLOAD │
                             └──────────┘

Problems:
- Single point of failure
- Performance degrades under load
- Maintenance requires downtime
```

### The Solution: Load Balancer

```
With Load Balancer:
                    ┌──────────────────┐     ┌──────────┐
                    │                  │ ──> │ Server A │
Users ────────────> │  Load Balancer   │ ──> │ Server B │
                    │                  │ ──> │ Server C │
                    └──────────────────┘     └──────────┘

Benefits:
- Traffic distributed evenly
- If Server B fails → traffic only goes to A and C
- Add more servers → load balancer includes them automatically
- Maintenance → remove server from rotation, no downtime
```

### Load Balancer Responsibilities

1. **Traffic distribution**: Spread requests across multiple targets
2. **Health checking**: Detect and route around unhealthy targets
3. **SSL termination**: Handle HTTPS decryption (so servers don't have to)
4. **Session persistence**: Send a user's requests to the same server (sticky sessions)
5. **Routing rules**: Route different paths to different services
6. **Security**: Integrate with AWS WAF, shield, security groups
7. **Observability**: Access logs, CloudWatch metrics, request tracing

### ELB vs Self-Managed

| Aspect | AWS ELB | Self-Managed (e.g., HAProxy/Nginx) |
|--------|---------|-----------------------------------|
| Setup | Minutes | Hours/days |
| Scaling | Automatic | Manual, requires planning |
| HA | Built-in across AZs | You must configure |
| Maintenance | AWS handles | You patch the OS, update software |
| Cost | Pay per LCU/hour | EC2 instances + your time |
| Features | Deep AWS integration | General purpose |

---

## 2. Types of ELB

AWS has four generations of load balancers. Understanding which to use is critical.

```
ELB Types:
┌───────────────────────────────────────────────────────────────┐
│  CLB (Classic)     Layer 4 + 7   Legacy, deprecated           │
│                                                                │
│  ALB (Application) Layer 7       HTTP/HTTPS, smart routing    │
│                                                                │
│  NLB (Network)     Layer 4       TCP/UDP, ultra-high perf     │
│                                                                │
│  GWLB (Gateway)    Layer 3       Third-party appliances        │
└───────────────────────────────────────────────────────────────┘
```

### OSI Model Context

```
OSI Layer | What it handles         | ELB Type
──────────┼─────────────────────────┼──────────────────
Layer 7   | HTTP headers, URLs, body│ ALB
Layer 4   | TCP/UDP ports, IPs       │ NLB
Layer 3   | IP packets               │ GWLB
```

### Quick Comparison

| Feature | ALB | NLB | GWLB | CLB |
|---------|-----|-----|------|-----|
| Protocol | HTTP/HTTPS/WebSocket/gRPC | TCP/UDP/TLS | IP | TCP/SSL/HTTP |
| Layer | 7 | 4 | 3 | 4+7 |
| Routing | Path, Host, Header, Query | Port/IP | IP | Basic |
| Static IP | Via NLB | Yes | N/A | No |
| Elastic IP | No | Yes | N/A | No |
| WebSocket | Yes | Yes | - | - |
| gRPC | Yes | No | - | No |
| Latency | ~1ms | ~100μs | - | - |
| Target types | Instance, IP, Lambda, ALB | Instance, IP, ALB | Instance, IP | Instance |
| Status | Current | Current | Current | Deprecated |

---

## 3. ALB Deep Dive

### What is an ALB?

Application Load Balancer operates at **Layer 7 (HTTP/HTTPS)**. It can make routing decisions
based on the content of the HTTP request — the URL path, hostname, headers, query parameters,
and even the HTTP method.

```
ALB Architecture:
                                          ┌──────────────────────────────┐
Internet                                  │  Target Group: web-servers   │
    │                                     │  [EC2-1] [EC2-2] [EC2-3]     │
    ▼                                  ┌─>└──────────────────────────────┘
┌──────┐    ┌──────────────────────┐   │
│      │    │  ALB                 │   │  ┌──────────────────────────────┐
│Client│──> │  Listener (port 80)  │───┤  │  Target Group: api-servers   │
│      │    │  + Routing Rules     │   ├─>│  [EC2-4] [EC2-5]             │
└──────┘    └──────────────────────┘   │  └──────────────────────────────┘
                                       │
                                       │  ┌──────────────────────────────┐
                                       │  │  Target Group: lambda-fn     │
                                       └─>│  [Lambda Function]           │
                                          └──────────────────────────────┘
```

### Listeners

A **Listener** is a process that checks for connection requests on a specific port and protocol.

- Each ALB can have multiple listeners (e.g., port 80 and port 443)
- Each listener has one or more rules that define what to do with incoming traffic

```
ALB
├── Listener: HTTP:80
│   └── Rule: Redirect all to HTTPS:443
└── Listener: HTTPS:443
    ├── Rule 1: /api/*  → Target Group: api-servers
    ├── Rule 2: /images/* → Target Group: image-servers
    └── Rule 3: Default → Target Group: web-servers
```

### Target Groups

A **Target Group** is a collection of targets (EC2 instances, IPs, Lambda functions, or other
ALBs) that receive traffic from a listener rule.

```
Target Group: api-servers
  Protocol: HTTP
  Port: 8080
  Target type: instance
  Health check path: /health
  Health check interval: 30 seconds
  
  Targets:
  ┌──────────────┬──────────────┬──────────────┐
  │  i-001       │  i-002       │  i-003       │
  │  10.0.1.10   │  10.0.2.10   │  10.0.3.10   │
  │  healthy     │  healthy     │  unhealthy   │
  └──────────────┴──────────────┴──────────────┘
  Traffic only goes to healthy targets (i-001 and i-002)
```

**Target types:**
- `instance`: Route to EC2 instances by instance ID
- `ip`: Route to any IP (EC2, on-prem, containers by pod IP)
- `lambda`: Route to a Lambda function
- `alb`: Route to another ALB (for complex routing)

### Path-Based Routing

Route requests to different target groups based on the URL path.

```
ALB Routing Rules:
┌──────────────────────────────────────────────────┐
│  IF path is /api/*                               │
│  THEN forward to Target Group: api-servers       │
├──────────────────────────────────────────────────┤
│  IF path is /images/*                            │
│  THEN forward to Target Group: image-servers     │
├──────────────────────────────────────────────────┤
│  IF path is /admin/*                             │
│  THEN return 403 Fixed Response                  │
├──────────────────────────────────────────────────┤
│  DEFAULT                                         │
│  Forward to Target Group: web-servers            │
└──────────────────────────────────────────────────┘

Request: GET /api/users/123
  → ALB → api-servers target group → API EC2 instance

Request: GET /images/logo.png
  → ALB → image-servers target group → Image EC2 instance

Request: GET /about
  → ALB → web-servers target group → Web EC2 instance
```

**Real-world example: Microservices on a single ALB**

```
myapp.com/api/users    → user-service target group     (Node.js)
myapp.com/api/orders   → order-service target group    (Python)
myapp.com/api/payments → payment-service target group  (Java)
myapp.com/*            → frontend target group          (React/Nginx)
```

This saves money — one ALB serves all services instead of one ALB per microservice.

### Host-Based Routing

Route based on the HTTP `Host` header (the domain name).

```
ALB Rules:
  IF host is api.myapp.com      → Target Group: api-servers
  IF host is admin.myapp.com    → Target Group: admin-servers
  IF host is myapp.com          → Target Group: web-servers
  IF host is *.myapp.com        → Target Group: wildcard-servers
```

**Use case**: One ALB handles traffic for multiple subdomains of your application.

### Header-Based and Other Conditions

ALB rules can match on:
- **Host header**: `api.myapp.com`
- **Path**: `/api/v2/*`
- **HTTP method**: `GET`, `POST`, `PUT`, `DELETE`
- **Query string**: `?version=2`
- **HTTP header**: `X-Custom-Header: value`
- **Source IP**: `192.168.0.0/16`

You can combine multiple conditions with AND logic:
```
IF host = api.myapp.com AND path = /v2/* AND method = POST
THEN forward to api-v2-servers target group
```

### HTTPS Termination (SSL/TLS Termination)

The ALB handles the TLS handshake and decryption, then forwards plain HTTP to backend instances.

```
Client ──HTTPS──> ALB (decrypts TLS) ──HTTP──> EC2 instances
                  ↑
          SSL certificate stored in ACM
          (AWS Certificate Manager)
```

**Benefits:**
- Backend instances don't need SSL certificates
- Backend instances don't use CPU for TLS processing
- Centralized certificate management in ACM
- Certificates auto-renew via ACM

**Setting up HTTPS:**
1. Request or import a certificate in ACM
2. Create HTTPS listener on ALB port 443
3. Associate the ACM certificate with the listener
4. Add a rule to redirect HTTP (port 80) to HTTPS:

```
Listener HTTP:80 Rule:
  Action: Redirect to HTTPS
  Port: 443
  Status code: 301
```

**SSL Security Policy**: Choose which TLS versions and cipher suites the ALB accepts.
- `ELBSecurityPolicy-TLS13-1-2-2021-06`: Recommended — TLS 1.2 and 1.3 only

### Sticky Sessions (Session Affinity)

Sends all requests from the same client to the same target.

```
Without sticky sessions:
  User session: Login → Request 1 → EC2-A (session created)
                        Request 2 → EC2-B (no session! logged out)

With sticky sessions:
  User session: Login → Request 1 → EC2-A (session created)
                        Request 2 → EC2-A (same server, session valid)
                        Request 3 → EC2-A (same server)
```

**Sticky session types:**

1. **Duration-based (ALB cookie)**: ALB generates a cookie (`AWSALB`) with an expiration.
   All requests with this cookie go to the same target.

2. **Application-based**: Your app generates a cookie. ALB reads your cookie to determine
   stickiness duration.

**When to avoid sticky sessions:**
- Stateless applications (store session in Redis/DynamoDB instead)
- When you want uniform load distribution
- Auto Scaling environments (a replaced instance breaks the session anyway)

**Best practice**: Design applications to be stateless. Store sessions in ElastiCache Redis.
This allows any instance to handle any request, eliminating the need for sticky sessions.

### WebSocket Support

ALB natively supports WebSocket connections. The connection is upgraded from HTTP to WebSocket
transparently. No special configuration needed — just use `ws://` or `wss://` in your app.

### gRPC Support

ALB supports gRPC routing and load balancing. Set the target group protocol version to gRPC.

### Weighted Target Groups

Send a percentage of traffic to different target groups. Useful for canary deployments:

```
New feature canary deployment:
  Production target group (old version): 90% of traffic
  Canary target group (new version):     10% of traffic

Monitor error rates and latency of the canary.
If healthy, increase weight to 50%, then 100%.
```

---

## 4. NLB Deep Dive

### What is an NLB?

Network Load Balancer operates at **Layer 4 (TCP/UDP)**. It routes traffic based on IP
protocol data — it does NOT examine HTTP headers, URLs, or cookies.

```
NLB Architecture:
Client ──TCP:443──> NLB ──TCP:443──> Target
           ↑
   Only sees: IP, Port, Protocol
   Does NOT see: URL path, HTTP headers, cookies
```

### NLB Key Characteristics

**Ultra-low latency**: NLB can handle millions of requests per second with < 100 microsecond
latency. Much faster than ALB (which adds ~1ms for Layer 7 processing).

**Static IP addresses**: Each NLB gets one static IP per AZ. These IPs never change, which is
critical when clients need to whitelist specific IPs in their firewalls.

**Elastic IP support**: You can assign your own Elastic IPs to the NLB's AZ nodes.

**Source IP preservation**: The client's real IP address is visible to backend targets
(unlike ALB which adds `X-Forwarded-For` headers).

**TLS termination**: NLB can terminate TLS (using ACM certificates), then forward as plain TCP.
Or it can pass-through TLS to the target (end-to-end encryption).

### When to Use NLB vs ALB

| Requirement | Use |
|-------------|-----|
| HTTP routing by URL/host/header | ALB |
| HTTPS with smart routing | ALB |
| WebSocket / gRPC | ALB |
| Microservices | ALB |
| Ultra-low latency (trading, gaming) | NLB |
| Non-HTTP protocols (SMTP, FTP, SSH, gaming) | NLB |
| Static IP / Elastic IP required | NLB |
| Client IP whitelist required by targets | NLB |
| IoT protocols (MQTT) | NLB |
| VPC endpoint services (PrivateLink) | NLB |

### NLB with ALB Behind It

A common pattern: NLB in front for static IP, ALB behind for smart routing.

```
Client ──> NLB (static IP, Layer 4) ──> ALB (smart routing, Layer 7) ──> EC2
```

Use when:
- You need static IPs (NLB feature)
- AND you need content-based routing (ALB feature)

---

## 5. Gateway Load Balancer

### What is GWLB?

Gateway Load Balancer operates at **Layer 3 (IP packet level)**. It is designed specifically
for deploying third-party network virtual appliances at scale.

```
Use cases:
- Firewalls (Palo Alto, Fortinet, Check Point)
- Intrusion Detection / Prevention Systems (IDS/IPS)
- Deep Packet Inspection (DPI)
- Network traffic analysis
```

### How GWLB Works

```
Internet
    │
    ▼
┌───────────────┐        ┌──────────────────────────┐
│     GWLB      │ ──────>│ Security Appliance Fleet │
│               │ <────── (Palo Alto, Fortinet, etc) │
└───────┬───────┘        └──────────────────────────┘
        │
        ▼
┌───────────────┐
│  Your EC2     │
│  Application  │
└───────────────┘

Traffic flow:
1. Packet arrives at GWLB
2. GWLB sends to security appliance
3. Security appliance inspects (and possibly blocks)
4. If allowed, packet returned to GWLB
5. GWLB forwards to application
```

GWLB uses the **GENEVE protocol** (port 6081) to encapsulate packets to/from appliances.

---

## 6. Health Checks

### How Health Checks Work

The load balancer continuously checks the health of each target. Only healthy targets receive
traffic.

```
ALB Health Check Flow:
┌─────────────────────────────────────────────────────┐
│                                                     │
│  Every 30 seconds (configurable):                   │
│                                                     │
│  ALB ──── GET /health ────> Target                  │
│                                                     │
│  If response is 200 OK within 5 seconds:            │
│    → Target is HEALTHY → receives traffic           │
│                                                     │
│  If response is 500 or timeout:                     │
│    → Consecutive failures tracked                   │
│    → After 2 consecutive failures: UNHEALTHY        │
│    → Traffic stops going to this target             │
│                                                     │
│  When target recovers:                              │
│    → After 2 consecutive successes: back to HEALTHY │
│    → Traffic resumes                                │
└─────────────────────────────────────────────────────┘
```

### Health Check Configuration

```
Target Group Health Check settings:
  Protocol:           HTTP
  Path:               /health        ← Your app must respond here
  Port:               traffic-port   ← Same port as traffic
  Healthy threshold:  2              ← 2 consecutive successes = healthy
  Unhealthy threshold: 2             ← 2 consecutive failures = unhealthy
  Timeout:            5 seconds      ← Response must arrive within 5s
  Interval:           30 seconds     ← Check every 30 seconds
  Success codes:      200            ← 200 = healthy; can be 200-299
```

### Implementing a Health Endpoint

Your application should expose a `/health` endpoint:

```javascript
// Node.js / Express
app.get('/health', (req, res) => {
  // Check database connectivity
  // Check required services
  // If all good:
  res.status(200).json({ status: 'healthy', timestamp: new Date() });
  // If something wrong:
  // res.status(500).json({ status: 'unhealthy', reason: 'DB connection failed' });
});
```

```python
# Python / Flask
@app.route('/health')
def health():
    # Check dependencies
    try:
        db.execute('SELECT 1')  # Quick DB ping
        return jsonify({'status': 'healthy'}), 200
    except Exception as e:
        return jsonify({'status': 'unhealthy', 'error': str(e)}), 500
```

**Health check best practices:**
- Keep `/health` fast (< 1 second)
- Check real dependencies (DB connection, required services)
- Use a dedicated endpoint (not `/` which may be heavy)
- Return 2xx only when truly healthy
- Return 5xx or timeout when unhealthy

### Target Health States

```
State          | Description
──────────────────────────────────────────────
initial        | Registering; health check not yet performed
healthy        | Passing health checks; receives traffic
unhealthy      | Failing health checks; no traffic
unused         | Not registered; no traffic
draining       | Connection draining in progress (deregistering)
unavailable    | Health checks disabled
```

### Connection Draining (Deregistration Delay)

When a target is deregistered (removed from target group or ASG scaling in), the ALB allows
**in-flight requests to complete** before fully removing the target.

```
Default deregistration delay: 300 seconds

Timeline:
t=0    Target starts deregistering
t=0    No NEW requests sent to this target
t=0-300  Existing in-flight requests can complete
t=300  Target fully deregistered
```

Reduce for fast-scaling environments where requests are short (< 5 seconds):
```
Target Group → Deregistration delay: 30 seconds
```

---

## 7. ALB + ASG Integration

### How It Works

```
Auto Scaling Group + ALB integration:

New Instance Launched:
  ASG launches instance
  → Instance passes health check grace period
  → ASG registers instance with ALB Target Group
  → ALB starts health checking the instance
  → Instance passes health checks
  → ALB starts sending traffic to instance

Instance Terminated:
  ASG marks instance for termination
  → ASG deregisters instance from ALB Target Group
  → ALB stops sending NEW requests to instance
  → Connection draining period (30-300 seconds)
  → In-flight requests complete
  → ASG terminates the instance
```

### Why This Integration Matters

Without this integration, you would manually have to:
- Register new instances with the load balancer
- Deregister terminating instances
- This would cause downtime during scale-in events

### Setting Up the Integration

In ASG creation:
```
Load balancing:
  ✓ Attach to an existing load balancer
  Choose target groups: web-servers-tg, api-servers-tg
  
  Health checks:
  ✓ Turn on Elastic Load Balancing health checks
  Health check grace period: 300 seconds
```

The ASG automatically registers and deregisters instances with all specified target groups.

---

## 8. Cross-Zone Load Balancing

### What Is Cross-Zone Load Balancing?

Without cross-zone load balancing, each load balancer node distributes traffic only to targets
in its own AZ.

```
WITHOUT Cross-Zone Load Balancing:
                     AZ-A (10 instances)  AZ-B (2 instances)
ALB-Node-AZ-A 50% → 5% each              -
ALB-Node-AZ-B 50% →                      25% each ← overloaded!
```

With cross-zone load balancing, each load balancer node distributes traffic evenly across
ALL targets in ALL AZs.

```
WITH Cross-Zone Load Balancing:
                     AZ-A (10 instances)  AZ-B (2 instances)
ALB-Node-AZ-A 50% ─────────────────────────────────> 8.3% each (total 12)
ALB-Node-AZ-B 50% ─────────────────────────────────> 8.3% each (total 12)
```

### Settings by Load Balancer Type

| ELB Type | Default | Configurable | Cross-AZ data charge |
|----------|---------|-------------|---------------------|
| ALB | Always ON | No (always on) | No (included) |
| NLB | OFF | Yes | Yes ($0.01/GB) |
| GWLB | OFF | Yes | Yes ($0.01/GB) |
| CLB | OFF | Yes | No |

For NLB: You pay for cross-AZ data transfer when cross-zone is enabled. For most workloads,
the even distribution is worth the small cost. But for extremely high-throughput NLB setups,
consider the data transfer cost.

---

## 9. Access Logs

### What are Access Logs?

ALB and NLB can log every request to **S3**. Useful for:
- Debugging issues (what was the exact request that caused the error?)
- Security analysis (who is hitting which endpoints?)
- Compliance and audit trails
- Performance analysis (p95/p99 latency by path)

### Enabling Access Logs

```
ALB → Attributes → Access logs
  → S3 bucket: my-alb-logs-bucket
  → Prefix: alb/prod/

The bucket must have a resource policy allowing ELB to write:
{
  "Effect": "Allow",
  "Principal": {
    "AWS": "arn:aws:iam::127311923021:root"  ← ELB service account for us-east-1
  },
  "Action": "s3:PutObject",
  "Resource": "arn:aws:s3:::my-alb-logs-bucket/alb/prod/AWSLogs/*"
}
```

### Access Log Format (ALB)

Each line in the log contains (space-delimited):
```
type timestamp elb client:port target:port request_processing_time
target_processing_time response_processing_time elb_status_code
target_status_code received_bytes sent_bytes request user_agent
ssl_cipher ssl_protocol target_group_arn trace_id domain_name
chosen_cert_arn matched_rule_priority request_creation_time
actions_executed redirect_url lambda_error_reason target_port_list
target_status_code_list classification classification_reason
```

Example line:
```
http 2024-01-15T10:30:00.123456Z app/my-alb/1234567890 
203.0.113.5:41284 10.0.1.50:80 0.000 0.001 0.000 
200 200 0 512 "GET https://myapp.com:443/api/users HTTP/1.1" 
"Mozilla/5.0..." - - arn:aws:elasticloadbalancing:... "Root=..." 
"myapp.com" "..." 0 2024-01-15T10:30:00.122000Z "forward" "-" "-" 
"10.0.1.50:80" "200" "-" "-"
```

### Querying Access Logs with Athena

Set up an Athena table to query access logs with SQL:

```sql
-- Find the top 10 slowest requests in the last hour
SELECT request,
       target_processing_time,
       elb_status_code,
       client_ip
FROM alb_access_logs
WHERE from_iso8601_timestamp(time) > current_timestamp - interval '1' hour
  AND target_processing_time > 1.0
ORDER BY target_processing_time DESC
LIMIT 10;

-- Count requests per status code
SELECT elb_status_code, COUNT(*) as count
FROM alb_access_logs
GROUP BY elb_status_code
ORDER BY count DESC;
```

---

## 10. Hands-On: Create ALB with Two EC2 Instances

### Architecture

```
Internet
    │
    ▼
[ALB]  (public subnets in 2 AZs)
    │
    ▼
[Target Group: web-servers]
    │          │
[EC2-A]    [EC2-B]
(AZ-a)     (AZ-b)
```

### Step 1: Launch Two EC2 Instances

**Instance A (AZ us-east-1a):**
```bash
# User data:
#!/bin/bash
yum update -y
yum install -y nginx
systemctl start nginx
systemctl enable nginx
echo "<h1>Server A - us-east-1a</h1>" > /usr/share/nginx/html/index.html
```

**Instance B (AZ us-east-1b):**
```bash
# User data:
#!/bin/bash
yum update -y
yum install -y nginx
systemctl start nginx
systemctl enable nginx
echo "<h1>Server B - us-east-1b</h1>" > /usr/share/nginx/html/index.html
```

Both instances should have:
- Security group allowing port 80 from the ALB security group (not from 0.0.0.0/0)
- No public IP needed (ALB in public subnet, instances in private subnet)

### Step 2: Create Security Groups

**ALB Security Group (alb-sg):**
```
Inbound:
  HTTP  TCP  80   0.0.0.0/0  (internet traffic)
  HTTPS TCP  443  0.0.0.0/0  (internet traffic)
Outbound:
  All traffic
```

**Instance Security Group (instance-sg):**
```
Inbound:
  HTTP  TCP  80  alb-sg   (only from ALB, not internet)
  SSH   TCP  22  your-ip  (for admin)
Outbound:
  All traffic
```

### Step 3: Create Target Group

```
EC2 → Target Groups → Create target group
  Target type: Instances
  Name: web-servers-tg
  Protocol: HTTP
  Port: 80
  VPC: your-vpc
  
  Health checks:
    Protocol: HTTP
    Path: /
    Healthy threshold: 2
    Unhealthy threshold: 2
    Timeout: 5
    Interval: 30
    Success codes: 200
  
  → Next → Register targets
    Select EC2-A and EC2-B
    Port: 80
    → Include as pending below
  → Create target group
```

### Step 4: Create Application Load Balancer

```
EC2 → Load Balancers → Create load balancer → Application Load Balancer
  
  Basic configuration:
    Name: web-alb
    Scheme: Internet-facing
    IP address type: IPv4
  
  Network mapping:
    VPC: your-vpc
    Mappings: ✓ us-east-1a (public-subnet-1a)
              ✓ us-east-1b (public-subnet-1b)
  
  Security groups:
    Remove default security group
    Add: alb-sg
  
  Listeners and routing:
    HTTP:80
    Default action: Forward to web-servers-tg
  
  → Create load balancer
```

### Step 5: Test Load Balancing

```bash
# Get the ALB DNS name (from EC2 → Load Balancers → Description)
ALB_DNS="web-alb-1234567890.us-east-1.elb.amazonaws.com"

# Test multiple times - you should see alternating responses
for i in {1..10}; do
  curl -s http://$ALB_DNS/
  echo ""
done

# Expected output alternates between:
# <h1>Server A - us-east-1a</h1>
# <h1>Server B - us-east-1b</h1>
```

### Step 6: Test Failover

```bash
# Stop nginx on Server A (simulates failure)
sudo systemctl stop nginx

# Wait ~60 seconds for health check to mark it unhealthy
# Then test again - all responses should come from Server B

for i in {1..5}; do
  curl -s http://$ALB_DNS/
  echo ""
done
# All responses should be: <h1>Server B - us-east-1b</h1>

# Start nginx again on Server A
sudo systemctl start nginx

# Wait ~60 seconds for health check to pass
# Traffic returns to both servers
```

### Step 7: Add HTTPS (Optional)

```
1. Request a certificate in ACM:
   AWS Certificate Manager → Request certificate
   → *.yourdomain.com and yourdomain.com
   → DNS validation (add CNAME to your DNS)
   → Wait for validation

2. Add HTTPS listener to ALB:
   ALB → Listeners → Add listener
   → Protocol: HTTPS, Port: 443
   → Default action: Forward to web-servers-tg
   → Certificates: select ACM certificate

3. Redirect HTTP to HTTPS:
   ALB → Listeners → HTTP:80 → Edit
   → Action: Redirect to HTTPS:443
   → Status code: 301

4. Update DNS:
   Create CNAME record: yourdomain.com → ALB DNS name
```

---

## 11. Interview Q&A

**Q1: What is the difference between ALB and NLB? When would you use each?**
ALB operates at Layer 7 (HTTP/HTTPS) and can make routing decisions based on URL paths, host
headers, HTTP methods, and other HTTP attributes. It supports WebSocket, gRPC, SSL termination,
sticky sessions, and integration with Lambda. Use ALB for web applications, microservices, and
any HTTP/HTTPS workload.

NLB operates at Layer 4 (TCP/UDP). It routes based on IP and port only — it never examines
HTTP content. It provides ultra-low latency (microseconds), static IP addresses per AZ,
Elastic IP support, and preserves source IP. Use NLB for real-time applications requiring
extreme performance, non-HTTP protocols (gaming, financial trading, IoT), or when clients
need to whitelist a static IP.

**Q2: What is a Target Group and what target types does ALB support?**
A Target Group is a logical collection of targets that receive forwarded requests from a
listener rule. ALB supports four target types:
- Instance: Route to EC2 instances by instance ID
- IP: Route to any IP address (EC2 private IP, container pod IP, on-premises via Direct Connect)
- Lambda: Route to a Lambda function (useful for serverless backends)
- ALB: Route to another ALB (for nested routing architectures)

**Q3: Explain path-based routing and give a real-world use case.**
Path-based routing directs requests to different target groups based on the URL path.
Real-world example: A microservices application with one ALB:
- `/api/users/*` → User Service target group (Go)
- `/api/orders/*` → Order Service target group (Java)
- `/api/products/*` → Product Service target group (Python)
- `/*` → Frontend target group (React/Nginx)

This allows one ALB to serve an entire microservices architecture, reducing cost and complexity
compared to deploying a separate load balancer per service.

**Q4: What is the difference between cross-zone load balancing enabled vs disabled?**
Without cross-zone: Each ALB node distributes traffic only to targets in its own AZ. If you have
10 instances in AZ-A and 2 in AZ-B, and DNS sends 50% of traffic to each AZ's ALB node, the 2
instances in AZ-B each receive 25% of total traffic while the 10 in AZ-A each receive only 5%.
Severe imbalance.

With cross-zone: Each ALB node distributes traffic evenly across all 12 instances regardless of
AZ. Each instance gets ~8.3% of traffic. ALB always has cross-zone enabled by default (and it's
free). NLB has it disabled by default but charges for cross-AZ data transfer if enabled.

**Q5: What is sticky sessions and what are the downsides?**
Sticky sessions (session affinity) ensures all requests from the same client go to the same
target, using a cookie set by the ALB or the application. Downsides: uneven load distribution
(a heavy user always hits the same server), breaks with Auto Scaling (scaling-in terminates
the sticky instance and loses the session), and adds complexity. The preferred alternative is
to design stateless applications and store session state externally (ElastiCache Redis), which
allows any instance to handle any request.

**Q6: How does SSL/TLS termination at the ALB work?**
The ALB handles the TLS handshake with the client using an SSL/TLS certificate from AWS ACM.
It decrypts the traffic and forwards plain HTTP to backend instances on the internal network.
Benefits: backend instances don't need certificates, don't spend CPU on TLS, and certificates
are managed centrally in ACM with auto-renewal. For end-to-end encryption (HTTPS to instances
too), you can re-encrypt traffic from ALB to targets using HTTPS in the target group, though
you need certificates on the instances as well.

**Q7: What happens when an ALB target becomes unhealthy?**
The ALB continuously polls each target via health checks (default every 30 seconds). When a
target fails the configured number of consecutive health checks (default 2), it transitions to
unhealthy state. The ALB immediately stops sending new requests to that target. Any in-flight
requests may fail. The ALB distributes traffic only to remaining healthy targets. When the target
recovers and passes the configured number of consecutive health checks (default 2), it transitions
back to healthy and starts receiving traffic again.

**Q8: What is the deregistration delay / connection draining?**
When a target is deregistered from a target group (manually, or automatically by an ASG scaling-in
action), the ALB allows in-flight requests to complete before fully removing the target from
rotation. During the draining period (default 300 seconds, configurable from 0 to 3600 seconds),
no new requests are sent to the target, but existing connections can finish. This prevents
abrupt request failures during deployments or scale-in events. For short-lived requests, set
this to a low value (30-60 seconds) for faster scale-in.

**Q9: What is the difference between an ALB listener rule action types?**
- Forward: Route traffic to one or more target groups (can use weights for canary)
- Redirect: Return a 301/302 redirect (commonly HTTP → HTTPS)
- Fixed Response: Return a custom HTTP response (useful for returning 403 on /admin/* or
  maintenance pages with 503)
- Authenticate (with OIDC or Cognito): Challenge the user to authenticate before forwarding

**Q10: How does the ALB integrate with AWS WAF?**
You can associate an AWS WAF Web ACL with an ALB. WAF inspects every HTTP request before it
reaches your application. You can create rules to:
- Block requests from specific IP ranges
- Block known malicious patterns (SQL injection, XSS)
- Rate-limit requests per IP (DDoS protection)
- Block requests by geographic location
- Use AWS managed rule groups (pre-built protection for OWASP Top 10)

When WAF blocks a request, it returns a 403 (or custom response) before the request reaches
your target group.

**Q11: Can you associate an Elastic IP with an ALB?**
No, ALBs do not support Elastic IPs or static IPs. ALB DNS names resolve to dynamic IPs that
can change. If you need static IPs with HTTP routing, put an NLB in front of the ALB (NLB
supports static IPs). Alternatively, use AWS Global Accelerator which provides static IP
addresses and routes to your ALB.

**Q12: What is the Gateway Load Balancer (GWLB) and when is it used?**
GWLB operates at Layer 3 (IP packet level) and is specifically designed for deploying third-party
network virtual appliances at scale — firewalls, IDS/IPS, deep packet inspection systems, and
traffic analyzers. GWLB transparently inserts these appliances into the traffic path using GENEVE
encapsulation. Traffic flows to GWLB, gets sent to the appliance fleet for inspection, then
returned to GWLB, which forwards to the destination. This allows elastic, highly-available
deployment of network security tools without changing application routing.
