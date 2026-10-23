# AWS Networking Quick Reference Cheatsheet

---

## CIDR Quick Reference Table

### How AWS Reserves IPs in Every Subnet

AWS reserves **5 IP addresses** in every subnet — the first 4 and the last 1:

| Reserved Address | Reserved For |
|---|---|
| x.x.x.**0** | Network address (identifies the subnet itself) |
| x.x.x.**1** | AWS VPC Router (default gateway for all instances) |
| x.x.x.**2** | AWS DNS (always VPC CIDR base address + 2, e.g., 10.0.0.2) |
| x.x.x.**3** | Reserved by AWS for future use |
| x.x.x.**255** | Network broadcast address (AWS does not support broadcast, but reserves it) |

**Practical Impact:** A /24 subnet has 256 total IPs but only 251 usable for EC2, RDS, Lambda ENIs, etc.

### CIDR Blocks: Total IPs vs AWS Usable IPs

| CIDR | Total IPs | AWS Usable IPs | Hosts Bits | Common Use Case |
|---|---|---|---|---|
| /8 | 16,777,216 | 16,777,211 | 24 | Entire 10.x.x.x private range |
| /12 | 1,048,576 | 1,048,571 | 20 | Entire 172.16.x.x – 172.31.x.x range |
| /16 | 65,536 | 65,531 | 16 | Recommended VPC size (maximum flexibility) |
| /20 | 4,096 | 4,091 | 12 | Large subnet or small VPC |
| /21 | 2,048 | 2,043 | 11 | Medium VPC or large subnet |
| /22 | 1,024 | 1,019 | 10 | Medium subnet |
| /23 | 512 | 507 | 9 | Medium subnet, good for app tier |
| /24 | 256 | 251 | 8 | Standard subnet size — most common choice |
| /25 | 128 | 123 | 7 | Half a /24, good for smaller tiers |
| /26 | 64 | 59 | 6 | Smaller subnet (e.g., bastion hosts, NAT) |
| /27 | 32 | 27 | 5 | Small subnet |
| /28 | 16 | 11 | 4 | Smallest practical AWS subnet |
| /29 | 8 | 3 | 3 | Very small (only 3 usable) |
| /30 | 4 | 0 | 2 | Point-to-point links only (not usable in AWS — 0 usable after reservations) |

**AWS VPC CIDR Constraints:**
- Minimum VPC size: /28
- Maximum VPC size: /16
- You can add secondary CIDR blocks to a VPC (max 5 IPv4 CIDR blocks per VPC by default)

**Quick mental math:** For a /X subnet: IPs = 2^(32-X). Subtract 5 for AWS usable count.
- /24 → 2^8 = 256 → 256 - 5 = 251 usable
- /26 → 2^6 = 64 → 64 - 5 = 59 usable

---

## Private IP Address Ranges (RFC 1918)

These ranges are never routed on the public internet. Always use these inside VPCs.

| Range | CIDR Notation | Total Addresses | Common AWS Use |
|---|---|---|---|
| 10.0.0.0 – 10.255.255.255 | 10.0.0.0/8 | 16,777,216 | Large enterprises, default AWS VPC recommendation |
| 172.16.0.0 – 172.31.255.255 | 172.16.0.0/12 | 1,048,576 | Medium orgs; AWS default VPC uses 172.31.0.0/16 |
| 192.168.0.0 – 192.168.255.255 | 192.168.0.0/16 | 65,536 | Small VPCs; common in home/lab environments |

**Note:** AWS default VPC (auto-created in each region) uses **172.31.0.0/16** with /20 subnets per AZ. It is recommended to create custom VPCs and avoid using the default VPC for production workloads.

**Avoid using overlapping CIDRs** across VPCs you may need to peer. Once a VPC CIDR is set, it cannot be changed (you can only add secondary CIDRs).

---

## AWS VPC Recommended CIDR Design

A well-structured VPC design separates concerns into clear subnet tiers across multiple AZs.

### Recommended 3-Tier Production VPC Layout

```
VPC: 10.0.0.0/16 (65,536 IPs total, 65,531 usable)
├── Region: us-east-1
│
├── PUBLIC SUBNETS (Internet-facing: ALB, NAT Gateway, Bastion)
│   ├── 10.0.1.0/24  — AZ us-east-1a (251 usable IPs)
│   └── 10.0.2.0/24  — AZ us-east-1b (251 usable IPs)
│
├── PRIVATE APP SUBNETS (Application tier: EC2, ECS, Lambda)
│   ├── 10.0.10.0/24  — AZ us-east-1a (251 usable IPs)
│   └── 10.0.20.0/24  — AZ us-east-1b (251 usable IPs)
│
└── PRIVATE DB SUBNETS (Database tier: RDS, ElastiCache, Redis)
    ├── 10.0.30.0/24  — AZ us-east-1a (251 usable IPs)
    └── 10.0.40.0/24  — AZ us-east-1b (251 usable IPs)
```

### Why This Design Works

- **Widely spaced CIDR ranges** (1.x, 2.x vs 10.x, 20.x vs 30.x, 40.x): easy to add new subnets without overlaps
- **Two AZs minimum** for high availability (add a third AZ if critical: 10.0.3.0/24, 10.0.11.0/24, etc.)
- **/24 per subnet** provides 251 usable IPs — plenty for most tiers without wasting the /16 space
- **Tier separation** allows fine-grained security group and NACL rules between layers
- **Reserved space:** Subnets 10.0.50.x–10.0.255.x remain available for future needs (new tiers, VPN, management subnets)

### Multi-Account / VPC Peering CIDR Strategy

When multiple VPCs need to peer, plan CIDRs so they never overlap:
```
Account: Production  → VPC: 10.0.0.0/16
Account: Staging     → VPC: 10.1.0.0/16
Account: Dev         → VPC: 10.2.0.0/16
Account: Shared Svcs → VPC: 10.3.0.0/16
On-premises          → 10.10.0.0/16 (via Direct Connect or VPN)
```

---

## Common Ports Reference Table

| Port | Protocol | Service / Application | Notes |
|---|---|---|---|
| 20 | TCP | FTP (data transfer) | Active FTP data channel |
| 21 | TCP | FTP (control) | FTP control/command channel |
| 22 | TCP | SSH / SFTP | Secure shell, secure file transfer |
| 23 | TCP | Telnet | Unencrypted — avoid in production |
| 25 | TCP | SMTP | Email relay between servers (often blocked by ISPs) |
| 53 | TCP + UDP | DNS | UDP for queries; TCP for zone transfers and large responses |
| 80 | TCP | HTTP | Unencrypted web traffic |
| 110 | TCP | POP3 | Email retrieval (unencrypted) |
| 143 | TCP | IMAP | Email retrieval protocol (unencrypted) |
| 389 | TCP | LDAP | Lightweight Directory Access Protocol |
| 443 | TCP | HTTPS | Encrypted web traffic (TLS) |
| 465 | TCP | SMTPS | SMTP over SSL (legacy, deprecated) |
| 514 | UDP | Syslog | System log shipping |
| 587 | TCP | SMTP Submission | Email client-to-server submission (STARTTLS) |
| 636 | TCP | LDAPS | LDAP over SSL |
| 993 | TCP | IMAPS | IMAP over SSL |
| 995 | TCP | POP3S | POP3 over SSL |
| 1433 | TCP | Microsoft SQL Server | MSSQL database |
| 1521 | TCP | Oracle Database | Oracle DB listener |
| 2049 | TCP + UDP | NFS | Network File System (EFS uses NFS v4.1) |
| 2181 | TCP | Apache ZooKeeper | Coordination service (MSK uses this) |
| 3000 | TCP | Node.js / Grafana | Common Node.js dev port; Grafana default |
| 3306 | TCP | MySQL / Aurora MySQL | Default MySQL database port |
| 3389 | TCP | RDP | Remote Desktop Protocol (Windows) |
| 5432 | TCP | PostgreSQL / Aurora PG | Default PostgreSQL database port |
| 5439 | TCP | Amazon Redshift | Redshift data warehouse |
| 5601 | TCP | Kibana / OpenSearch Dashboards | OpenSearch Dashboards UI |
| 6379 | TCP | Redis / ElastiCache Redis | In-memory data store |
| 8080 | TCP | HTTP Alternative | Common alternate HTTP port |
| 8443 | TCP | HTTPS Alternative | Common alternate HTTPS port |
| 9092 | TCP | Apache Kafka / MSK | Kafka broker (plaintext) |
| 9094 | TCP | Apache Kafka / MSK | Kafka broker (TLS) |
| 9200 | TCP | Elasticsearch / OpenSearch | REST API for OpenSearch |
| 9300 | TCP | Elasticsearch | Node-to-node cluster communication |
| 11211 | TCP + UDP | Memcached | ElastiCache Memcached |
| 27017 | TCP | MongoDB / DocumentDB | MongoDB wire protocol; used by DocumentDB |

**AWS Security Group Tip:** When opening a port for RDS, use the Security Group of the application as the Source rather than a CIDR block. This ensures only your app instances can reach the database, even as IPs change.

---

## Security Group vs NACL Comparison Table

| Feature | Security Group | Network ACL (NACL) |
|---|---|---|
| **Scope** | Attached to ENI (network interface) of an EC2, RDS, ALB, Lambda, etc. | Attached to a Subnet. Applies to all resources in that subnet. |
| **Stateful / Stateless** | **Stateful** — return traffic is automatically allowed regardless of outbound rules | **Stateless** — return traffic must be explicitly allowed in both inbound AND outbound rules |
| **Rule Types** | Allow rules ONLY — cannot deny specific traffic | Allow AND Deny rules — can explicitly block IP ranges |
| **Rule Processing** | All rules evaluated; most permissive match wins | Rules evaluated in **number order** (lowest first). First matching rule wins. Processing stops. |
| **Default Behavior (new)** | All inbound DENIED, all outbound ALLOWED | Default NACL: all inbound and outbound ALLOWED |
| **Default Behavior (custom)** | N/A | Custom NACL: all inbound and outbound DENIED until rules added |
| **Inbound rule numbers** | Not numbered (order irrelevant) | Numbered (100, 200, etc.) — order matters |
| **Deny capability** | No — cannot explicitly deny specific IPs | Yes — can add a DENY rule before an ALLOW to block specific IPs |
| **Association level** | One SG can apply to many ENIs; one ENI can have up to 5 SGs | One NACL per subnet; one subnet has exactly one NACL |
| **Return traffic** | Automatically allowed (stateful) | Must open ephemeral ports 1024-65535 in outbound rules |
| **IP range support** | CIDR blocks or other Security Group IDs as source | CIDR blocks only (cannot reference Security Groups) |
| **When to use** | Primary access control for all resources — first line of defense | Block specific IPs (e.g., DDoS source), broad subnet-level rules, compliance requirements |
| **Typical use** | Allow only port 443 from ALB SG to App SG | Block a known malicious IP range from reaching entire subnet |

**Key Exam Points:**
- Security Groups are **stateful**: if inbound port 80 is allowed, the response traffic goes out automatically
- NACLs are **stateless**: you must allow inbound AND the ephemeral return ports outbound
- NACLs process rules **in order** — a DENY 200 before ALLOW 300 for the same IP will block it
- You can use NACLs to block an IP that might otherwise reach an instance with a broad SG rule
- Security Groups cannot reference IP ranges across accounts, but can reference SGs within the same VPC or peered VPCs

---

## Route53 Routing Policies Summary Table

| Policy | Use Case | Health Check Required | Description |
|---|---|---|---|
| **Simple** | Single resource, no redundancy | No | Returns a single record (or multiple values — client picks randomly). No health checks. Use for basic DNS with one resource. |
| **Weighted** | A/B testing, gradual traffic shifts | Optional | Distributes traffic by percentage weights (e.g., 90% to v1, 10% to v2). Use for blue/green deployments. Weight 0 = no traffic. |
| **Latency** | Multi-region, lowest latency for users | Optional | Routes to the AWS region with lowest measured network latency for the user. Does not consider geographic proximity — based on actual latency. |
| **Failover** | Active-passive disaster recovery | Yes (required for primary) | Primary record serves traffic. If primary health check fails, Route53 automatically fails over to secondary. |
| **Geolocation** | Data sovereignty, region-specific content | Optional | Routes based on user's geographic location (country, continent). Precise — specific country overrides continent overrides default. Returns 404 if no match and no default. |
| **Geoproximity** | Shift traffic based on geographic bias | Optional | Routes based on geographic distance with configurable bias. Increase bias to attract more traffic to a region; decrease to push traffic away. Requires Route53 Traffic Flow. |
| **Multivalue Answer** | Improved simple with health checks | Optional | Returns up to 8 healthy records, client picks one. Like Simple but with health check filtering. Not a substitute for a load balancer. |

**Additional Notes:**
- Weighted with equal weights (e.g., all = 10) distributes traffic evenly across all records
- Geolocation requires a "Default" record as a catch-all or unmatched queries return NXDOMAIN
- Failover requires an active health check on the primary record; secondary can be any record type
- Latency routing database: AWS measures latency from ~64 edge locations to each region continuously
- Traffic Flow (paid feature) allows combining multiple policies using a visual policy tree

---

## DNS Record Types Reference Table

| Record Type | Full Name | Maps From | Maps To | Example | Notes |
|---|---|---|---|---|---|
| **A** | Address Record | Domain name | IPv4 address | `api.example.com → 1.2.3.4` | Most common record type |
| **AAAA** | IPv6 Address Record | Domain name | IPv6 address | `api.example.com → 2001:db8::1` | IPv6 equivalent of A record |
| **CNAME** | Canonical Name | Domain name | Another domain name | `www.example.com → example.com` | Cannot be used at zone apex (root domain). Creates redirect chain. |
| **MX** | Mail Exchange | Domain name | Mail server hostname + priority | `example.com → 10 mail.example.com` | Lower priority number = higher preference |
| **TXT** | Text Record | Domain name | Arbitrary text string | `example.com → "v=spf1 include:..."` | Used for SPF, DKIM, domain verification, DMARC |
| **NS** | Name Server | Zone name | Authoritative name servers | `example.com → ns1.awsdns-01.com` | Delegates zone authority to name servers |
| **SOA** | Start of Authority | Zone | Zone metadata | Serial, refresh, retry, expire, TTL values | One per zone; contains zone versioning info |
| **PTR** | Pointer Record | IP address | Domain name | `4.3.2.1.in-addr.arpa → api.example.com` | Reverse DNS lookup. Used for email reputation. |
| **SRV** | Service Record | Service name | Host + port + priority + weight | `_sip._tcp.example.com → 10 20 5060 sip.example.com` | Service discovery; used by SIP, XMPP, etc. |
| **CAA** | Certification Authority Authorization | Domain | Authorized CA | `example.com → 0 issue "letsencrypt.org"` | Specifies which CAs can issue SSL certs |

### AWS Alias Record — How It Differs from CNAME

AWS Route53 provides a special **Alias** record type that extends standard DNS:

| Feature | CNAME | AWS Alias |
|---|---|---|
| Works at zone apex (root domain) | NO — CNAME cannot be at apex | YES — can alias example.com to ALB |
| Can point to | Any domain name | AWS resources only (ALB, CloudFront, S3, API Gateway, Elastic Beanstalk, VPC endpoints, other R53 records) |
| Extra DNS lookup charge | Yes — charged per query to resolve the CNAME chain | No — Route53 resolves alias internally, no extra charge |
| TTL control | You set the TTL | TTL automatically matches target resource |
| When target IP changes | CNAME chain must be followed | Alias auto-updates as ALB IP addresses change |
| Health checks | Supported | Supported |
| Example use | `www.example.com → example.com` | `example.com → my-alb-123.us-east-1.elb.amazonaws.com` |

**When to use Alias over CNAME:**
- Root domain pointing to ALB, CloudFront, S3 website: use Alias (CNAME not allowed at apex)
- Pointing to any AWS resource: prefer Alias (free, auto-updates, no extra query charge)
- Pointing to a non-AWS domain: must use CNAME

---

## VPC Components Summary Table

| Component | What It Does | Key Facts |
|---|---|---|
| **VPC** | Logically isolated virtual network within an AWS region | CIDR range /16 to /28. Spans all AZs in a region. Cannot change primary CIDR after creation. |
| **Public Subnet** | Subnet whose route table has a route to an Internet Gateway | Resources need a public or Elastic IP to communicate with internet |
| **Private Subnet** | Subnet with no direct internet route | Outbound internet access via NAT Gateway; inbound requires ALB in public subnet |
| **Internet Gateway (IGW)** | Allows VPC resources to communicate with the internet | One IGW per VPC. Horizontally scaled, highly available. No bandwidth limits. Free (pay for data transfer). |
| **NAT Gateway** | Allows private subnet resources to initiate outbound internet connections | Deployed in public subnet. Managed by AWS. $0.045/hr + $0.045/GB processed. Deploy one per AZ for HA. |
| **Route Table** | Controls where network traffic is directed | Each subnet associated with one route table. Main route table is default. Local route (VPC CIDR) cannot be deleted. |
| **Security Group** | Virtual firewall at the ENI level (instance/service level) | Stateful. Allow rules only. Multiple SGs per instance (up to 5). Reference other SG IDs as source. |
| **NACL** | Subnet-level firewall | Stateless. Allow + Deny rules. Rules processed in number order. One NACL per subnet. |
| **VPC Endpoint (Gateway)** | Private route to S3 or DynamoDB within AWS network | Free. Attached to route table. Only for S3 and DynamoDB. No bandwidth limits. |
| **VPC Endpoint (Interface)** | Private route to other AWS services via PrivateLink | $0.01/hr + $0.01/GB. Creates ENI in your subnet. Supports 100+ AWS services. Requires DNS resolution. |
| **VPC Peering** | Private network connection between two VPCs | One-to-one. Not transitive (A↔B, B↔C does NOT give A↔C). Can peer across regions and accounts. No overlapping CIDRs. |
| **Transit Gateway** | Hub-and-spoke network hub connecting multiple VPCs and on-premises | Transitive routing. One attachment handles many VPC connections. $0.05/hr per attachment + $0.02/GB. Replaces complex VPC peering meshes. |
| **VPN Gateway (VGW)** | Terminates Site-to-Site VPN connection in AWS | $0.05/hr. Up to 1.25 Gbps throughput. Two IPSec tunnels per connection for HA. |
| **Direct Connect** | Dedicated private network connection from on-premises to AWS | Consistent bandwidth (1 Gbps to 100 Gbps). Does not traverse public internet. Requires hardware at Direct Connect location. |
| **Bastion Host** | EC2 instance in public subnet used as SSH jump server to reach private instances | No longer needed if using Systems Manager Session Manager (SSM). |

---

## Complete VPC Architecture — ASCII Diagram

```
                              INTERNET
                                 |
                    ┌────────────┴────────────┐
                    │    INTERNET GATEWAY      │
                    │         (IGW)            │
                    └────────────┬────────────┘
                                 │
           ┌─────────────────────┼─────────────────────┐
           │         VPC: 10.0.0.0/16                  │
           │                                            │
   ┌───────┴──────── PUBLIC SUBNETS ────────────────┐  │
   │   ┌─────────────────┐   ┌─────────────────┐    │  │
   │   │  AZ us-east-1a  │   │  AZ us-east-1b  │    │  │
   │   │  10.0.1.0/24    │   │  10.0.2.0/24    │    │  │
   │   │                 │   │                 │    │  │
   │   │  ┌───────────┐  │   │  ┌───────────┐  │    │  │
   │   │  │    ALB    │◄─┼───┼─►│    ALB    │  │    │  │
   │   │  │  Node 1   │  │   │  │  Node 2   │  │    │  │
   │   │  └───────────┘  │   │  └───────────┘  │    │  │
   │   │  ┌───────────┐  │   │  ┌───────────┐  │    │  │
   │   │  │    NAT    │  │   │  │    NAT    │  │    │  │
   │   │  │  Gateway  │  │   │  │  Gateway  │  │    │  │
   │   │  └─────┬─────┘  │   │  └─────┬─────┘  │    │  │
   │   │  ┌───────────┐  │   │  ┌───────────┐  │    │  │
   │   │  │  Bastion  │  │   │  │  (opt.)   │  │    │  │
   │   │  │   Host    │  │   │  │  Bastion  │  │    │  │
   │   │  └───────────┘  │   │  └───────────┘  │    │  │
   │   └────────┬────────┘   └────────┬────────┘    │  │
   └────────────┼────────────────────┼──────────────┘  │
                │                    │                  │
   ┌────────────┼── PRIVATE APP ─────┼──────────────┐  │
   │   ┌────────┴────────┐   ┌───────┴─────────┐    │  │
   │   │  AZ us-east-1a  │   │  AZ us-east-1b  │    │  │
   │   │  10.0.10.0/24   │   │  10.0.20.0/24   │    │  │
   │   │                 │   │                 │    │  │
   │   │  ┌───────────┐  │   │  ┌───────────┐  │    │  │
   │   │  │ EC2 App   │  │   │  │ EC2 App   │  │    │  │
   │   │  │ Instance  │  │   │  │ Instance  │  │    │  │
   │   │  │ (ASG)     │  │   │  │ (ASG)     │  │    │  │
   │   │  └─────┬─────┘  │   │  └─────┬─────┘  │    │  │
   │   └────────┼────────┘   └────────┼────────┘    │  │
   └────────────┼────────────────────┼──────────────┘  │
                │                    │                  │
   ┌────────────┼── PRIVATE DB ──────┼──────────────┐  │
   │   ┌────────┴────────┐   ┌───────┴─────────┐    │  │
   │   │  AZ us-east-1a  │   │  AZ us-east-1b  │    │  │
   │   │  10.0.30.0/24   │   │  10.0.40.0/24   │    │  │
   │   │                 │   │                 │    │  │
   │   │  ┌───────────┐  │   │  ┌───────────┐  │    │  │
   │   │  │    RDS    │  │   │  │    RDS    │  │    │  │
   │   │  │ Primary   │  │   │  │ Standby   │  │    │  │
   │   │  │ (Multi-AZ)│◄─┼───┼─►│ (Multi-AZ)│  │    │  │
   │   │  └───────────┘  │   │  └───────────┘  │    │  │
   │   └─────────────────┘   └─────────────────┘    │  │
   └─────────────────────────────────────────────────┘  │
           │                                             │
           └─────────────────────────────────────────────┘

TRAFFIC FLOW:
  Inbound:  Internet → IGW → ALB (public subnet) → EC2 App (private) → RDS (private)
  Outbound: EC2 App → NAT Gateway (public subnet) → IGW → Internet
  S3/DynamoDB: EC2 App → Gateway VPC Endpoint (no NAT, no internet)

SECURITY BOUNDARIES:
  [SG: alb-sg]        → Allow 443 from 0.0.0.0/0
  [SG: app-sg]        → Allow 8080 from alb-sg only
  [SG: db-sg]         → Allow 3306/5432 from app-sg only
  [SG: bastion-sg]    → Allow 22 from corporate IP range only
  [NACL: public]      → Allow 443/80 in, Ephemeral ports out
  [NACL: private-app] → Allow from VPC CIDR, deny all else
  [NACL: private-db]  → Allow 3306/5432 from app subnet CIDR only
```

---

## OSI Model Quick Reference

| Layer | Layer Name | Protocol Examples | AWS / Networking Relevance |
|---|---|---|---|
| **7** | Application | HTTP, HTTPS, DNS, SMTP, FTP, SSH | ALB (Layer 7 — sees HTTP headers, URLs, host headers). API Gateway. CloudFront. WAF. |
| **6** | Presentation | TLS/SSL, JPEG, ASCII | TLS termination at ALB/CloudFront. ACM manages TLS certificates. |
| **5** | Session | NetBIOS, RPC, SIP | Connection pooling, RDS Proxy (manages database sessions) |
| **4** | Transport | TCP, UDP | NLB (Layer 4 — routes by IP:port). Security Groups operate here (port-based). NACL rules. |
| **3** | Network | IP, ICMP, BGP, OSPF | VPC routing, Route Tables, Internet Gateway, NAT Gateway. BGP used in Direct Connect. |
| **2** | Data Link | Ethernet, ARP, MAC | Within the same subnet. ARP resolves IP to MAC. VPC fabric handles this transparently. |
| **1** | Physical | Electrical signals, fiber | AWS Direct Connect physical cables. Data center hardware. |

**Practical AWS Mappings:**
- **ALB = Layer 7** — can route based on URL path (`/api/* → service A`, `/static/* → S3`), Host header, query strings, HTTP method
- **NLB = Layer 4** — routes based on IP address and port only. Supports TCP, UDP, TLS. Preserves source IP. Ultra-low latency.
- **Security Groups = Layer 4** — allow/deny by protocol and port number (TCP/443, UDP/53, etc.)
- **WAF = Layer 7** — inspects HTTP request content, headers, body; blocks SQL injection, XSS, etc.
- **CloudFront = Layer 7** — caches HTTP responses, routes by URL, terminates TLS at edge

---

## HTTP Status Codes Reference

| Code Range | Category | Common Codes | Meaning |
|---|---|---|---|
| **1xx** | Informational | 100 Continue, 101 Switching Protocols | Server acknowledges request, processing continues |
| **2xx** | Success | 200 OK, 201 Created, 202 Accepted, 204 No Content | Request was successful |
| **3xx** | Redirection | 301 Moved Permanently, 302 Found (temporary redirect), 304 Not Modified | Client must take additional action to complete request |
| **4xx** | Client Error | 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 405 Method Not Allowed, 422 Unprocessable Entity, 429 Too Many Requests | Client made an error |
| **5xx** | Server Error | 500 Internal Server Error, 502 Bad Gateway, 503 Service Unavailable, 504 Gateway Timeout | Server encountered an error |

### Critical 4xx Codes

| Code | Meaning | AWS Context |
|---|---|---|
| **400** | Bad Request — malformed request syntax | Malformed API call to AWS services, missing required parameters |
| **401** | Unauthorized — authentication required | Missing or invalid auth token. IAM: expired credentials |
| **403** | Forbidden — authenticated but not authorized | IAM: valid credentials but no permission. S3 bucket policy denying access. CloudFront geo-restriction. |
| **404** | Not Found — resource doesn't exist | S3 object not found. API Gateway resource path doesn't exist. |
| **429** | Too Many Requests — rate limit exceeded | API Gateway throttling (default: 10,000 req/s, burst 5,000). Lambda concurrency limit. |

### Critical 5xx Codes and AWS Causes

| Code | Meaning | Common AWS Causes |
|---|---|---|
| **500** | Internal Server Error | Lambda function unhandled exception. EC2 application crash. |
| **502** | Bad Gateway | ALB received invalid response from target. EC2 app crashed/returned garbage. Target returned HTTP 502. |
| **503** | Service Unavailable | ALB has no healthy targets in Target Group. All EC2 instances failed health checks. App is overloaded. |
| **504** | Gateway Timeout | ALB timed out waiting for EC2 response (default: 60 seconds). Database query too slow. External API call hung. Lambda timeout (if behind API Gateway). |

**ALB-Specific Error Codes:**
- **502 from ALB:** Back-end application returned a malformed HTTP response
- **503 from ALB:** No registered targets in target group, or all targets are unhealthy
- **504 from ALB:** Target didn't respond within the idle timeout period (default 60 seconds)
- **460 from ALB:** Client closed connection before ALB could send response (client-side issue)
- **561 from ALB:** Authentication failed when using ALB with Cognito or OIDC auth

---

## Encryption Ports Reference

| Service | Default (Unencrypted) Port | Encrypted Port | Protocol / Notes |
|---|---|---|---|
| HTTP | 80 | 443 (HTTPS) | TLS 1.2+ recommended |
| MySQL | 3306 | 3306 (same port, TLS enabled in config) | Require SSL via `--require_secure_transport` parameter |
| Aurora MySQL | 3306 | 3306 (TLS in transit) | Enable with `require_secure_transport` parameter group |
| PostgreSQL | 5432 | 5432 (same port, sslmode=require) | Use `sslmode=verify-full` for cert verification |
| Aurora PostgreSQL | 5432 | 5432 (TLS in transit) | Same as PostgreSQL |
| Redis (ElastiCache) | 6379 | 6380 (TLS Redis) | In-transit encryption enabled at cluster creation |
| Memcached | 11211 | 11211 (TLS) | ElastiCache Memcached supports TLS |
| Elasticsearch / OpenSearch | 9200 (REST), 9300 (inter-node) | 443 (via fine-grained access control) | OpenSearch Service exposes HTTPS on 443 |
| SMTP | 25 | 465 (SMTPS), 587 (STARTTLS) | 587 with STARTTLS is modern standard |
| LDAP | 389 | 636 (LDAPS) | Active Directory, LDAP for authentication |
| Redshift | 5439 | 5439 (SSL in connection string) | Set `require_ssl=true` in parameter group |
| MongoDB / DocumentDB | 27017 | 27017 (TLS) | DocumentDB requires TLS by default |
| FTP | 21 (control), 20 (data) | 990 (FTPS), 22 (SFTP) | SFTP over SSH is preferred over FTPS |

**Important AWS Encryption Note:**
- RDS encryption at rest (EBS encryption) is separate from in-transit TLS encryption
- At-rest encryption: enabled at RDS instance creation (cannot be changed after — must snapshot + restore)
- In-transit encryption: enable TLS in the parameter group AND configure your application to require SSL
- S3: All S3 traffic uses HTTPS by default. Use bucket policy to deny HTTP: `"Condition": {"Bool": {"aws:SecureTransport": "false"}}`
