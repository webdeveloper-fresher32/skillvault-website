# 03 - Networking Basics

## Table of Contents
1. [IP Addresses](#ip-addresses)
2. [Public vs Private IP](#public-vs-private-ip)
3. [CIDR Notation](#cidr-notation)
4. [DNS - Domain Name System](#dns)
5. [Domain Names Explained](#domain-names)
6. [Ports](#ports)
7. [HTTP vs HTTPS](#http-vs-https)
8. [TCP vs UDP](#tcp-vs-udp)
9. [NAT - Network Address Translation](#nat)
10. [Firewalls](#firewalls)
11. [Load Balancers](#load-balancers)
12. [Subnets](#subnets)
13. [Route Tables](#route-tables)
14. [AWS Mapping for Every Concept](#aws-mapping)
15. [Interview Q&A](#interview-qa)

---

## 1. IP Addresses

### What is an IP Address?

An IP address (Internet Protocol address) is a unique numerical label assigned to every device on a network. It serves two main purposes:
1. **Identification:** Who is this device?
2. **Location:** Where is this device on the network?

Think of it like a home address. Just as a postal system needs your street address to deliver mail, the internet needs an IP address to deliver data to the right device.

### IPv4

IPv4 (Internet Protocol version 4) is the most common format.

**Format:** 4 groups of numbers separated by dots. Each group is an "octet" (8 bits = 1 byte).

```
Example: 192.168.1.100

   192    .    168    .    1    .    100
   |            |          |          |
 Octet 1    Octet 2    Octet 3    Octet 4

Each octet: 0 to 255 (because 8 bits = 2^8 = 256 possible values, 0-255)

Binary breakdown of 192:
192 = 128 + 64 = 11000000 in binary

Full address in binary:
192.168.1.100 = 11000000.10101000.00000001.01100100
```

**Total IPv4 addresses:** 2^32 = ~4.3 billion addresses

**The IPv4 exhaustion problem:** 4.3 billion addresses sounds like a lot, but with billions of devices (phones, computers, IoT devices, servers), the world ran out of unique public IPv4 addresses around 2011. This is why we have:
1. **Private IPs + NAT** (many devices share one public IP)
2. **IPv6**

### IPv6

IPv6 is the successor to IPv4 with a vastly larger address space.

**Format:** 8 groups of 4 hexadecimal digits, separated by colons.

```
Example: 2001:0db8:85a3:0000:0000:8a2e:0370:7334

Can be shortened:
2001:db8:85a3::8a2e:370:7334
(:: represents consecutive groups of zeros)

Total IPv6 addresses: 2^128 = 340 undecillion (340 trillion trillion trillion)
= Enough for every atom on Earth to have an IP address
```

**IPv4 vs IPv6 Comparison:**

| Feature | IPv4 | IPv6 |
|---------|------|------|
| **Format** | 32-bit, decimal | 128-bit, hexadecimal |
| **Example** | 192.168.1.1 | 2001:db8::1 |
| **Total Addresses** | ~4.3 billion | ~340 undecillion |
| **Notation** | 4 octets, dots | 8 groups, colons |
| **Header Size** | 20 bytes | 40 bytes |
| **NAT Required** | Yes (address exhaustion) | No |
| **AWS Support** | Full | Growing |

**AWS and IPv6:** AWS VPCs support both IPv4 and IPv6. EC2 instances can have both. ALBs can be dual-stack.

---

## 2. Public vs Private IP

### The Fundamental Distinction

Not all IP addresses are created equal. Some are **public** (reachable from anywhere on the internet), and some are **private** (only reachable within a local network).

```
The Internet
+------------------------------------------------------------------+
|                                                                  |
|  Public IPs - globally unique, routable on the internet         |
|  203.0.113.1, 8.8.8.8 (Google DNS), 54.239.28.85 (Amazon)      |
|                                                                  |
+------------------------------------------------------------------+
         |                              |
    Your Home Network              Corporate Network
    +-----------------+             +-----------------+
    | Router          |             | Firewall/Router  |
    | Public: 203.0.x |             | Public: 104.0.x  |
    |                 |             |                  |
    | Private subnet  |             | Private subnet   |
    | 192.168.1.0/24  |             | 10.0.0.0/8       |
    |                 |             |                  |
    | Phone: .1.5     |             | Server1: 10.0.1.1|
    | Laptop: .1.10   |             | Server2: 10.0.1.2|
    | TV:     .1.15   |             | DB:      10.0.2.1|
    +-----------------+             +-----------------+
```

### Private IP Ranges (RFC 1918)

Three reserved ranges are designated as private — routers on the internet will never forward packets with these source/destination addresses:

```
Private IP Ranges:

Range 1: 10.0.0.0 - 10.255.255.255
         Written as: 10.0.0.0/8
         Size: 16,777,216 addresses (16 million)
         Common use: Large enterprise networks, AWS VPCs

Range 2: 172.16.0.0 - 172.31.255.255
         Written as: 172.16.0.0/12
         Size: 1,048,576 addresses (1 million)
         Common use: Medium networks, Docker default

Range 3: 192.168.0.0 - 192.168.255.255
         Written as: 192.168.0.0/16
         Size: 65,536 addresses
         Common use: Home routers (192.168.1.x most common)
```

**Memory trick:** 10.x.x.x | 172.16-31.x.x | 192.168.x.x = Private. Everything else is public.

### How to Identify Public vs Private

```
Is 192.168.50.4 public or private?
  - Starts with 192.168? -> Private

Is 10.0.3.255 public or private?
  - Starts with 10.? -> Private

Is 172.17.0.1 public or private?
  - Starts with 172.16-31? 172.17 = in range 172.16-172.31 -> Private

Is 203.0.113.45 public or private?
  - Not in any private range -> Public

Is 172.32.0.1 public or private?
  - 172.32 is ABOVE 172.31 -> Public (just above the private range)

Is 8.8.8.8 public or private?
  - Not in any private range -> Public (Google DNS)
```

### When Each is Used

**Public IP:**
- Your web server that users access from the internet
- AWS NAT Gateway (needs a public IP to communicate with internet)
- An EC2 instance that needs to be directly internet-accessible
- Load balancer endpoints that customers connect to

**Private IP:**
- EC2 instances in private subnets (databases, app servers)
- All internal communication within a VPC
- RDS database instances (should never have public IP)
- Any resource that doesn't need direct internet access

### AWS IP Assignment

```
EC2 Instance in AWS:
+---------------------------------+
| EC2 Instance                    |
|                                 |
| Private IP: 10.0.1.45           | <- Always assigned, stays for life of instance
| Public IP: 54.239.28.85         | <- Assigned if in public subnet, CHANGES on restart
| Elastic IP (EIP): 52.20.1.1    | <- Static public IP, stays even after restart
+---------------------------------+
```

**Elastic IP (EIP):** A static public IP you can allocate and attach to resources. If your EC2 instance is replaced (after a failure), you can attach the same EIP to the new instance. Your users don't need to update their DNS.

---

## 3. CIDR Notation

### What is CIDR?

CIDR (Classless Inter-Domain Routing) notation is a compact way to describe a range of IP addresses — a network block.

**Format:** `IP_address/prefix_length`

The prefix length (the number after /) tells you how many bits are fixed (the network part) vs variable (the host part).

### Understanding the Slash Notation

```
Example: 192.168.1.0/24

IP in binary: 11000000.10101000.00000001.00000000
                                          ^^^^^^^^
Prefix /24 means: first 24 bits are FIXED (the network)
                  last 8 bits are VARIABLE (the hosts)

Fixed:    11000000.10101000.00000001  = 192.168.1
Variable: 00000000 to 11111111       = 0 to 255

So 192.168.1.0/24 represents all IPs from 192.168.1.0 to 192.168.1.255
Total: 2^8 = 256 addresses
Usable: 254 (first = network address, last = broadcast address)
```

### Common CIDR Blocks and Their Sizes

```
CIDR         | # of IPs  | Host Bits | Range Example
-------------|-----------|-----------|------------------
/8           | 16,777,216| 24 bits   | 10.0.0.0 - 10.255.255.255
/16          | 65,536    | 16 bits   | 192.168.0.0 - 192.168.255.255
/24          | 256       | 8 bits    | 192.168.1.0 - 192.168.1.255
/28          | 16        | 4 bits    | 192.168.1.0 - 192.168.1.15
/32          | 1         | 0 bits    | 192.168.1.5 (single IP)

Formula: Number of IPs = 2^(32 - prefix_length)

/24 -> 2^(32-24) = 2^8 = 256
/16 -> 2^(32-16) = 2^16 = 65,536
/8  -> 2^(32-8)  = 2^24 = 16,777,216
/32 -> 2^(32-32) = 2^0 = 1
```

### Subnet Mask Alternative Notation

CIDR prefixes have equivalent subnet masks:

```
/8  = 255.0.0.0
/16 = 255.255.0.0
/24 = 255.255.255.0
/28 = 255.255.255.240
/32 = 255.255.255.255
```

### AWS VPC CIDR Examples

```
AWS VPC design:

VPC CIDR: 10.0.0.0/16 (65,536 IPs total)
  |
  +-- Public Subnet AZ-a:  10.0.1.0/24  (256 IPs)
  |   For: Load Balancers, NAT Gateways, Bastion hosts
  |
  +-- Public Subnet AZ-b:  10.0.2.0/24  (256 IPs)
  |
  +-- Private Subnet AZ-a: 10.0.10.0/24 (256 IPs)
  |   For: Application servers, EC2 instances
  |
  +-- Private Subnet AZ-b: 10.0.11.0/24 (256 IPs)
  |
  +-- Private Subnet AZ-a: 10.0.20.0/24 (256 IPs)
  |   For: Databases (RDS)
  |
  +-- Private Subnet AZ-b: 10.0.21.0/24 (256 IPs)
```

**AWS reserves 5 IPs per subnet (you lose 5):**
- .0: Network address
- .1: VPC router
- .2: AWS DNS
- .3: Future use
- .255: Broadcast address

So a /24 (256 IPs) gives you 251 usable IPs in AWS.

---

## 4. DNS - Domain Name System

### The Problem DNS Solves

Computers communicate using IP addresses. But humans can't remember that Amazon is at 205.251.242.103. We remember "amazon.com".

DNS is the system that translates human-readable domain names into machine-readable IP addresses.

DNS = The internet's phone book.

### How DNS Resolution Works (Step by Step)

```
You type: www.amazon.com in your browser

Step 1: Browser Cache Check
Browser: "Do I have www.amazon.com cached from before?"
  - If YES -> use cached IP, skip DNS
  - If NO -> proceed to Step 2

Step 2: OS Cache / Hosts File Check
OS checks /etc/hosts file and local DNS cache
  - If found -> use it, skip DNS
  - If not -> proceed to Step 3

Step 3: Query Recursive Resolver (usually your ISP or 8.8.8.8)
Your computer asks: "Hey DNS resolver (8.8.8.8), what is www.amazon.com?"

Step 4: Recursive Resolver Asks Root Name Server
Resolver: "Hey Root Server, who handles .com?"
Root Server: "Ask the .com TLD nameserver at 192.5.6.30"

Root Name Servers (13 of them, labeled a.root-servers.net through m.root-servers.net)

Step 5: Recursive Resolver Asks TLD Name Server
Resolver: "Hey .com TLD server, who handles amazon.com?"
.com TLD: "Ask Amazon's authoritative nameserver at 205.251.196.1"

Step 6: Recursive Resolver Asks Authoritative Name Server
Resolver: "Hey Amazon's nameserver, what is the IP for www.amazon.com?"
Amazon's NS: "It's 205.251.242.103" + TTL: 300 seconds

Step 7: Answer Returned and Cached
Resolver tells your browser: "205.251.242.103"
Resolver caches the answer for 300 seconds (TTL)
Browser caches it too

Step 8: TCP Connection to IP
Browser connects to 205.251.242.103:443 (HTTPS)

Full journey:
Browser -> Resolver -> Root NS -> TLD NS -> Authoritative NS -> IP back
(This whole process takes ~50-200ms, happens once then cached)
```

### DNS Record Types

```
Record Type | Purpose                    | Example
------------|----------------------------|----------------------------------
A           | Domain to IPv4 address     | amazon.com -> 205.251.242.103
AAAA        | Domain to IPv6 address     | amazon.com -> 2600:1f18:...
CNAME       | Domain to domain (alias)   | www.amazon.com -> amazon.com
MX          | Mail server for domain     | amazon.com -> mail.amazon.com
TXT         | Text info (SPF, DKIM)      | "v=spf1 include:amazon.com"
NS          | Nameservers for domain     | amazon.com -> ns1.p31.dynect.net
SOA         | Start of Authority (admin  | Technical DNS zone info
            | info for zone)             |
PTR         | Reverse DNS (IP to domain) | 103.242.251.205.in-addr.arpa -> amazon.com
```

**AWS Route 53 is Amazon's DNS service.** It handles all these record types.

### TTL (Time to Live)

TTL is the number of seconds a DNS record should be cached.

```
amazon.com A record:
  IP: 205.251.242.103
  TTL: 300

This means: "Cache this answer for 300 seconds (5 minutes)"
After 5 minutes, clients must query DNS again.

Low TTL (60 seconds): Good for when you might change IPs soon (before migrations)
High TTL (86400 = 1 day): Good for stable records (reduces DNS query load)
```

---

## 5. Domain Names Explained

### Anatomy of a Domain Name

```
https://www.docs.amazon.com/en/aws/guide.html
        |   |   |       |
        |   |   |       +-- TLD (Top-Level Domain): .com
        |   |   +---------- SLD (Second-Level Domain): amazon
        |   +-------------- Subdomain: docs
        +------------------ Subdomain: www

Reading right to left is how DNS hierarchy works:
  .com         <- TLD (root is to the right of this)
  amazon.com   <- Registered domain (SLD + TLD)
  docs.amazon.com <- Subdomain
  www.docs.amazon.com <- Sub-subdomain
```

### Types of TLDs

```
Generic TLDs (.com, .org, .net, .io, .app)
  - .com: Commercial (most common)
  - .org: Organizations (Wikipedia uses it)
  - .net: Network providers
  - .io: Tech startups (originally British Indian Ocean Territory)
  - .app: Applications (owned by Google)

Country Code TLDs (ccTLDs)
  - .uk: United Kingdom
  - .au: Australia
  - .de: Germany
  - .jp: Japan
  - .cn: China

Sponsored TLDs
  - .gov: US government only
  - .edu: US educational institutions only
  - .mil: US military
```

### Subdomains

Subdomains are prefixes you add to your domain. You control them entirely.

```
amazon.com (root domain)
  |
  +-- www.amazon.com       (main website)
  +-- api.amazon.com       (API endpoint)
  +-- mail.amazon.com      (email server)
  +-- docs.amazon.com      (documentation)
  +-- console.aws.amazon.com (AWS console)
  +-- s3.amazonaws.com     (S3 service)
```

Subdomains are free — you don't register them separately. Create a DNS record and the subdomain exists.

---

## 6. Ports

### What is a Port?

An IP address identifies a machine. A port identifies a specific application or service on that machine.

**Analogy:** If the IP address is the building address (123 Main Street), the port is the apartment number (Apt 443). Many services can run on the same machine, each on a different port.

```
Server IP: 54.239.28.85

              +----------------------------------+
              | 54.239.28.85                     |
Port 22 ----> |   SSH daemon (sshd)              |
Port 80 ----> |   nginx (HTTP web server)        |
Port 443 ---> |   nginx (HTTPS web server)       |
Port 3306 --> |   MySQL database                 |
Port 6379 --> |   Redis cache                    |
              |   (All running simultaneously)   |
              +----------------------------------+
```

### Port Ranges

```
Well-Known Ports:   0 - 1023   (System/root required to bind)
Registered Ports:   1024 - 49151 (Applications register with IANA)
Dynamic/Private:    49152 - 65535 (Ephemeral, for outgoing connections)
```

### Common Ports Table

| Port | Protocol | Service | Notes |
|------|----------|---------|-------|
| **20** | TCP | FTP Data | File transfer data channel |
| **21** | TCP | FTP Control | File transfer control channel |
| **22** | TCP | SSH | Secure Shell remote access |
| **23** | TCP | Telnet | Insecure remote access (avoid) |
| **25** | TCP | SMTP | Email sending |
| **53** | TCP/UDP | DNS | Domain name resolution |
| **67/68** | UDP | DHCP | IP address assignment |
| **80** | TCP | HTTP | Unencrypted web traffic |
| **110** | TCP | POP3 | Email retrieval |
| **143** | TCP | IMAP | Email retrieval |
| **389** | TCP | LDAP | Directory services |
| **443** | TCP | HTTPS | Encrypted web traffic |
| **465** | TCP | SMTPS | Encrypted email sending |
| **587** | TCP | SMTP | Email submission |
| **636** | TCP | LDAPS | Encrypted LDAP |
| **993** | TCP | IMAPS | Encrypted IMAP |
| **995** | TCP | POP3S | Encrypted POP3 |
| **1433** | TCP | MSSQL | Microsoft SQL Server |
| **1521** | TCP | Oracle | Oracle database |
| **3000** | TCP | Node.js | Common dev port |
| **3306** | TCP | MySQL | MySQL/MariaDB |
| **3389** | TCP | RDP | Windows Remote Desktop |
| **5432** | TCP | PostgreSQL | PostgreSQL database |
| **5672** | TCP | AMQP | RabbitMQ |
| **6379** | TCP | Redis | Redis cache |
| **8080** | TCP | HTTP Alt | Alternative HTTP, dev servers |
| **8443** | TCP | HTTPS Alt | Alternative HTTPS |
| **9200** | TCP | Elasticsearch | Elasticsearch REST API |
| **27017** | TCP | MongoDB | MongoDB database |

### Ports in AWS Security Groups

AWS Security Groups use ports to control traffic. A security group rule says:
"Allow TCP traffic on port 443 from 0.0.0.0/0 (anywhere)"

```
AWS Security Group for a Web Server:

Inbound Rules:
  Port 443  TCP  0.0.0.0/0    <- Allow HTTPS from internet
  Port 80   TCP  0.0.0.0/0    <- Allow HTTP from internet (for redirect)
  Port 22   TCP  10.0.0.0/8   <- Allow SSH only from VPN/internal network

Outbound Rules:
  All Traffic  All  0.0.0.0/0  <- Allow all outbound (common)
```

---

## 7. HTTP vs HTTPS

### HTTP (HyperText Transfer Protocol)

HTTP is the protocol for transmitting web pages. It's the language web browsers and servers use to communicate.

**HTTP is unencrypted** — data sent in plain text. Anyone between you and the server can read it.

### HTTP Request-Response Cycle

```
Browser (Client)                    Web Server
     |                                   |
     | 1. GET /index.html HTTP/1.1        |
     |    Host: example.com               |
     |    User-Agent: Chrome/120          |
     |    Accept: text/html               |
     | ---------------------------------> |
     |                                   |
     | 2. HTTP/1.1 200 OK                 |
     |    Content-Type: text/html         |
     |    Content-Length: 1234            |
     |    Date: Mon, 08 Jun 2026          |
     |    Server: nginx/1.24              |
     |                                   |
     |    <html>                          |
     |      <body>Hello World</body>      |
     |    </html>                         |
     | <--------------------------------- |
     |                                   |
```

**HTTP Request Components:**

```
GET /api/users HTTP/1.1
Host: api.example.com
Authorization: Bearer eyJhbGc...
Content-Type: application/json
Accept: application/json

{
  "filter": "active"
}

^       ^            ^
|       |            |
Method  Path         HTTP Version

HTTP Methods:
GET    - Retrieve data (no body)
POST   - Create data (has body)
PUT    - Replace data completely (has body)
PATCH  - Update data partially (has body)
DELETE - Delete data
HEAD   - Like GET but no response body (check headers only)
OPTIONS- What methods does this endpoint support?
```

**HTTP Status Codes:**

```
1xx - Informational
  100 Continue

2xx - Success
  200 OK          <- Standard success
  201 Created     <- Resource created (after POST)
  204 No Content  <- Success but no response body (after DELETE)

3xx - Redirection
  301 Moved Permanently  <- Page moved, update your bookmark
  302 Found              <- Temporary redirect
  304 Not Modified       <- Use your cached version

4xx - Client Error (YOU did something wrong)
  400 Bad Request      <- Malformed request
  401 Unauthorized     <- Need to authenticate
  403 Forbidden        <- Authenticated but no permission
  404 Not Found        <- Resource doesn't exist
  429 Too Many Requests <- Rate limited

5xx - Server Error (SERVER did something wrong)
  500 Internal Server Error <- Generic server error
  502 Bad Gateway           <- Upstream server error
  503 Service Unavailable   <- Server overloaded/down
  504 Gateway Timeout       <- Upstream didn't respond in time
```

### HTTPS (HTTP Secure)

HTTPS = HTTP + TLS (Transport Layer Security) encryption.

**What HTTPS provides:**
1. **Encryption:** Data in transit is encrypted. Even if intercepted, it's unreadable.
2. **Authentication:** You're talking to the real server (not an impostor). Verified by SSL certificate.
3. **Integrity:** Data wasn't tampered with in transit.

```
HTTP Connection (insecure):

Client <-------PLAINTEXT-------> Server
         "password=mysecret"
         Anyone on the network can read this!

HTTPS Connection (secure):

Client <----ENCRYPTED TUNNEL---> Server
         "X#@$!%^8fK3nQ2w..."
         Unreadable to anyone intercepting
```

**The difference in URLs:**
- `http://example.com` — Port 80, no encryption
- `https://example.com` — Port 443, TLS encrypted

**AWS and HTTPS:**
- ALB (Application Load Balancer): Terminates HTTPS, talks HTTP to backend (SSL termination)
- ACM (AWS Certificate Manager): Free SSL/TLS certificates for AWS services
- CloudFront: Forces HTTPS for all connections

---

## 8. TCP vs UDP

### TCP (Transmission Control Protocol)

TCP is a connection-oriented protocol. Before sending data, it establishes a connection. It guarantees delivery, order, and error checking.

**The TCP Three-Way Handshake:**

```
Client (wants to connect)          Server
      |                                |
      | 1. SYN (I want to connect)     |
      | ----------------------------> |
      |                                |
      | 2. SYN-ACK (OK, I acknowledge) |
      | <---------------------------- |
      |                                |
      | 3. ACK (Great, let's talk)     |
      | ----------------------------> |
      |                                |
      | === Connection Established === |
      |                                |
      | 4. [Data transfer begins]      |
      | ----------------------------> |
      | <---------------------------- |
      |                                |
      | 5. FIN (I'm done)              |
      | ----------------------------> |
      | <------- FIN-ACK ------------ |
      |                                |
      = Connection Closed              =
```

**TCP Guarantees:**
1. **Reliable delivery:** Lost packets are retransmitted
2. **Ordered delivery:** Packets arrive in the right order
3. **Error checking:** Checksum on every packet
4. **Flow control:** Doesn't overwhelm the receiver
5. **Congestion control:** Reduces sending rate when network is congested

**TCP Use Cases:**
- HTTP/HTTPS web browsing (losing a piece of a webpage would be bad)
- SSH (losing a command character would break things)
- Email (SMTP, IMAP)
- File transfers (FTP, SFTP)
- Database connections (MySQL, PostgreSQL)
- Any application where data integrity is critical

### UDP (User Datagram Protocol)

UDP is connectionless. There's no handshake, no guarantee of delivery, no ordering. It just sends packets and hopes they arrive.

```
UDP Client                   UDP Server
    |                             |
    | Data packet 1 -----------> |
    | Data packet 2 -----------> | (maybe arrives before 1)
    | Data packet 3 --X          | (packet 3 lost, nobody knows)
    | Data packet 4 -----------> |
    |                             |
    No connection setup
    No acknowledgment
    No retransmission
    Very low overhead
```

**Why Would You Want UDP?**

Speed and low latency. TCP's reliability comes with overhead (handshake, acknowledgments, retransmission). Sometimes losing a packet is acceptable, and speed is more important.

**UDP Use Cases:**

1. **Video Streaming:** A few dropped frames are barely noticeable. Retransmitting them would cause a pause worse than the dropped frame.

2. **Voice over IP (VoIP):** A brief audio glitch is better than retransmitting audio 500ms late (completely useless then).

3. **Online Gaming:** Game state updates happen 60 times/second. An old position update that arrives late is useless. Better to drop it and wait for the next one.

4. **DNS Queries:** Small, single request-response. Fast. If no response, just retry.

5. **Streaming Media:** Live broadcasts — stale data is worthless.

### TCP vs UDP Comparison

| Feature | TCP | UDP |
|---------|-----|-----|
| **Connection** | Connection-oriented (3-way handshake) | Connectionless |
| **Reliability** | Guaranteed delivery (retransmits lost packets) | No guarantee |
| **Order** | Packets delivered in order | No ordering guarantee |
| **Speed** | Slower (overhead for reliability) | Faster (minimal overhead) |
| **Error Checking** | Yes, with correction | Yes, but no correction |
| **Header Size** | 20 bytes | 8 bytes |
| **Use Cases** | HTTP, SSH, FTP, databases | Video, VoIP, gaming, DNS |
| **Protocols using it** | HTTP, HTTPS, SSH, SMTP, FTP | DNS, DHCP, video streaming, NTP |

---

## 9. NAT - Network Address Translation

### The Problem NAT Solves

Private IP addresses can't communicate directly with the internet. The internet doesn't know how to route to 10.0.1.50 because millions of private networks use that same address space.

NAT solves this by mapping private IPs to a public IP for outbound connections.

### How NAT Works

```
Private Network                NAT Gateway/Router            Internet
10.0.0.0/16                    (Public IP: 54.1.2.3)

EC2: 10.0.1.5                         |
  wants to reach google.com           |
       |                              |
       | 1. Source: 10.0.1.5          |
       |    Dest: 8.8.8.8:443         |
       | ---------------------------> |
       |                              | NAT Table:
       |                              | 10.0.1.5:51234 <-> 54.1.2.3:51234
       |                              |
       |                              | 2. Source: 54.1.2.3:51234
       |                              |    Dest: 8.8.8.8:443
       |                              | --------------------------> Google
       |                              |
       |                              | 3. Response from Google:
       |                              |    Source: 8.8.8.8:443
       |                              |    Dest: 54.1.2.3:51234
       |                              | <-------------------------- Google
       |                              |
       | 4. NAT translates back:      |
       |    Source: 8.8.8.8           |
       |    Dest: 10.0.1.5:51234      |
       | <--------------------------- |
```

**Key points:**
- NAT is stateful — it remembers the mapping
- Multiple private instances can share one public IP
- Inbound connections from internet to private IPs are NOT allowed (by default)
- This is a security feature — your private instances aren't directly reachable

**AWS NAT Gateway:**
- A managed service in the public subnet
- Private subnet instances route internet traffic through it
- Costs money (hourly + data transfer) — a common AWS cost item
- HA within one AZ; for multi-AZ HA, create one per AZ

```
AWS NAT Architecture:

Internet
    |
Internet Gateway (IGW)
    |
Public Subnet (10.0.1.0/24)
    +-- NAT Gateway (gets public IP, e.g., 54.x.x.x)
    +-- Load Balancer
    +-- Bastion Host

Private Subnet (10.0.10.0/24)
    +-- EC2 App Server -> route to NAT GW for internet
    +-- EC2 App Server -> route to NAT GW for internet
    
Private Subnet (10.0.20.0/24)
    +-- RDS Database   -> No internet access needed
```

---

## 10. Firewalls

### What is a Firewall?

A firewall is a network security device (hardware or software) that monitors and controls incoming and outgoing network traffic based on predetermined security rules.

Think of it as a bouncer at a club — it checks your ID (packet headers) against a list of rules and decides: allow in or block.

### Stateful vs Stateless Firewalls

**Stateless Firewall:**
- Examines each packet independently
- Doesn't know about previous packets in the same connection
- Rules applied to every single packet
- Must explicitly allow return traffic

```
Stateless Firewall Rules (Network ACL in AWS):

Inbound Rule:
  Allow TCP port 443 from 0.0.0.0/0

A client connects:
  Packet 1: SYN from 203.x.x.x:51234 to your-server:443 -> ALLOWED
  Packet 2: ACK from 203.x.x.x:51234 to your-server:443 -> ALLOWED

Outbound Rule (needed separately):
  Allow TCP port 1024-65535 to 0.0.0.0/0
  (Return traffic uses ephemeral ports on client side)

  If you forget the outbound rule, SYN gets in but SYN-ACK can't get out.
  The connection silently fails.
```

**Stateful Firewall:**
- Tracks the state of connections
- If you allow inbound traffic, return traffic is automatically allowed
- More intelligent, easier to manage

```
Stateful Firewall (Security Group in AWS):

Inbound Rule:
  Allow TCP port 443 from 0.0.0.0/0

Connection tracking:
  Client 203.x.x.x:51234 connects to :443 -> Connection tracked
  All return traffic for this connection automatically allowed
  No outbound rule needed for return traffic

Security Groups in AWS are STATEFUL.
Network ACLs in AWS are STATELESS.
```

### Firewall Rule Concepts

**Direction:** Inbound (ingress) or Outbound (egress)

**Rule components:**
```
Allow/Deny | Protocol | Port Range | Source/Destination | Priority
-----------+----------+------------+--------------------+----------
Allow      | TCP      | 443        | 0.0.0.0/0          | 100
Allow      | TCP      | 22         | 10.0.0.0/8         | 200
Deny       | All      | All        | 0.0.0.0/0          | 999

Rules evaluated in priority order (lower number = higher priority)
First matching rule wins
```

**AWS Security Group vs Network ACL:**

| Feature | Security Group | Network ACL |
|---------|---------------|-------------|
| **Level** | Instance level | Subnet level |
| **State** | Stateful | Stateless |
| **Default** | Deny all inbound, allow all outbound | Allow all |
| **Rules** | Allow only (no deny) | Allow and Deny |
| **Evaluation** | All rules evaluated | Rules in order, first match wins |
| **Applies to** | EC2, RDS, Lambda, etc. | All traffic in/out of subnet |

---

## 11. Load Balancers

### The Problem Load Balancers Solve

```
Without a Load Balancer:
                              Server 1: CPU 95% (overwhelmed)
Users (1000/sec) ----------> (only one server, everyone hits it)

With a Load Balancer:
                     +-----> Server 1: CPU 33% (healthy)
Users (1000/sec) --> LB ---> Server 2: CPU 33% (healthy)
                     +-----> Server 3: CPU 33% (healthy)

Benefits:
1. Distribute traffic across multiple servers
2. Remove unhealthy servers from rotation
3. Single entry point (one DNS name, one IP)
4. Enable zero-downtime deployments
5. SSL termination
```

### How Load Balancers Work

```
Load Balancer Operation:

1. Health Checks:
   LB -> "GET /health HTTP/1.1" -> Server 1
   Server 1 -> "200 OK" -> LB (healthy, send traffic)
   
   LB -> "GET /health HTTP/1.1" -> Server 2
   Server 2 -> No response (unhealthy, stop sending traffic)

2. Traffic Distribution Algorithms:

   Round Robin (default):
   Request 1 -> Server 1
   Request 2 -> Server 2
   Request 3 -> Server 3
   Request 4 -> Server 1 (back to beginning)

   Least Connections:
   Server 1: 10 active connections
   Server 2: 3 active connections <- send next request here
   Server 3: 7 active connections

   IP Hash (Sticky Sessions):
   Client IP 203.x.x.x always routes to Server 2
   (Used when session data is stored locally on server)
```

### Types of Load Balancers

```
Layer 4 (Network/Transport Layer):
  - Works at TCP/UDP level
  - Routes based on IP address and port
  - Very fast, low latency
  - Doesn't see HTTP headers or content
  - AWS: Network Load Balancer (NLB)

Layer 7 (Application Layer):
  - Works at HTTP level
  - Can route based on URL path, headers, host
  - Can terminate SSL
  - Content-based routing
  - AWS: Application Load Balancer (ALB)
```

**AWS ALB Routing Examples:**
```
ALB with path-based routing:

/api/*      -> Target Group 1 (API servers)
/static/*   -> Target Group 2 (static file servers)
/admin/*    -> Target Group 3 (admin servers)
/* (default)-> Target Group 4 (main app servers)

ALB with host-based routing:
api.example.com   -> Target Group: API
admin.example.com -> Target Group: Admin portal
app.example.com   -> Target Group: Main application
```

### SSL Termination

```
Without SSL Termination:
Client --HTTPS--> Server 1 (each server handles SSL)
                  Server 2 (each server handles SSL)
                  Server 3 (each server handles SSL)
(Each server needs the certificate, CPU overhead on each)

With SSL Termination at Load Balancer:
Client --HTTPS--> ALB --HTTP--> Server 1 (no SSL overhead)
                       --HTTP--> Server 2
                       --HTTP--> Server 3
(SSL certificate on ALB only, backend traffic is HTTP within VPC)
(Simpler, better performance, one place to manage cert)
```

---

## 12. Subnets

### What is a Subnet?

A subnet (sub-network) is a logical subdivision of an IP network. You divide your large network (VPC) into smaller subnets for organization, security, and routing.

```
VPC: 10.0.0.0/16 (your entire private network in AWS)
     |
     +-- Subnet 1: 10.0.1.0/24 (Public - has route to internet)
     |     EC2s here CAN talk to internet
     |
     +-- Subnet 2: 10.0.2.0/24 (Public - has route to internet)
     |     EC2s here CAN talk to internet
     |
     +-- Subnet 3: 10.0.10.0/24 (Private - no direct internet route)
     |     EC2s here CANNOT receive inbound internet
     |     CAN make outbound requests via NAT Gateway
     |
     +-- Subnet 4: 10.0.11.0/24 (Private)
     |
     +-- Subnet 5: 10.0.20.0/24 (Isolated - no internet at all)
           RDS databases here
           Cannot reach internet, internet cannot reach them
```

### Public vs Private Subnets

**Public Subnet:**
- Has a route in its route table pointing to an Internet Gateway (IGW)
- EC2 instances with public IPs are directly reachable from the internet
- Where you put: Load balancers, NAT gateways, bastion hosts

**Private Subnet:**
- No direct route to the Internet Gateway
- EC2 instances are not directly reachable from the internet
- Can still access internet via NAT Gateway (outbound only)
- Where you put: Application servers, worker processes

**Isolated/Database Subnet:**
- No route to internet at all (not even via NAT)
- Only reachable from other resources within the VPC
- Where you put: Databases, internal services that should never touch internet

```
3-Tier Architecture with Subnets:

Internet
    |
Internet Gateway
    |
+-- Public Subnet ------+
|  Load Balancer         |  <- Users hit this
|  NAT Gateway          |  <- Private subnets use this for internet
+------------------------+
           |
+-- Private Subnet -----+
|  EC2 App Servers       |  <- Application logic
|  (no public IP)        |
+------------------------+
           |
+-- Isolated Subnet ----+
|  RDS Database          |  <- Data layer
|  (no internet access)  |
+------------------------+
```

---

## 13. Route Tables

### What is a Route Table?

A route table is a set of rules (routes) that determine where network traffic is directed. Every subnet in a VPC must be associated with a route table.

```
Route Table for Public Subnet:

Destination     Target
-----------     ------
10.0.0.0/16     local         <- All traffic within VPC stays local
0.0.0.0/0       igw-0abc123   <- All other traffic -> Internet Gateway

Interpretation:
- Talk to 10.0.1.x? Stay within the VPC (local route)
- Talk to anything else (internet)? Send to the Internet Gateway
```

```
Route Table for Private Subnet:

Destination     Target
-----------     ------
10.0.0.0/16     local         <- VPC-internal traffic stays local
0.0.0.0/0       nat-0xyz456   <- Internet traffic -> NAT Gateway
                               (not internet gateway directly!)

Interpretation:
- Talk to other VPC resources? Stay local
- Need to reach internet (for updates, APIs)? Go through NAT
- Inbound from internet? Not possible (NAT is one-way)
```

```
Route Table for Isolated Subnet (Database):

Destination     Target
-----------     ------
10.0.0.0/16     local         <- Only local VPC traffic

Interpretation:
- Can only talk to other resources in the VPC
- No internet access in or out
```

### Route Priority (Most Specific Wins)

```
If a route table has:
  10.0.0.0/16 -> local
  10.0.5.0/24 -> specific-gateway
  0.0.0.0/0   -> internet-gateway

For destination 10.0.5.45:
  Matches 10.0.0.0/16 AND 10.0.5.0/24
  10.0.5.0/24 is MORE SPECIFIC (/24 > /16)
  -> Uses specific-gateway

For destination 10.0.2.100:
  Matches only 10.0.0.0/16
  -> Uses local

For destination 8.8.8.8:
  Matches only 0.0.0.0/0
  -> Uses internet-gateway

Most specific (longest prefix) wins.
```

---

## 14. AWS Mapping for Every Concept

| Networking Concept | AWS Service/Feature |
|--------------------|---------------------|
| **Network (your private network)** | VPC (Virtual Private Cloud) |
| **Subnet** | AWS VPC Subnets (public/private) |
| **IP Addressing** | VPC CIDR blocks, EC2 private IPs |
| **Public IP** | Elastic IP (EIP), auto-assigned public IP |
| **Internet connectivity** | Internet Gateway (IGW) |
| **NAT** | NAT Gateway (managed), NAT Instance (DIY) |
| **DNS** | Route 53 (DNS service), VPC DNS resolver |
| **Firewall (stateful, instance-level)** | Security Groups |
| **Firewall (stateless, subnet-level)** | Network ACL (NACL) |
| **Load Balancer (Layer 7, HTTP)** | Application Load Balancer (ALB) |
| **Load Balancer (Layer 4, TCP/UDP)** | Network Load Balancer (NLB) |
| **Load Balancer (classic, old)** | Classic Load Balancer (CLB) |
| **Route Tables** | VPC Route Tables |
| **CDN (Content Delivery Network)** | CloudFront |
| **Dedicated connection to AWS** | AWS Direct Connect |
| **VPN to AWS** | AWS Site-to-Site VPN |
| **DNS Failover** | Route 53 health checks and failover routing |
| **Private connectivity between services** | VPC Endpoints, VPC Peering |
| **SSL Certificates** | ACM (AWS Certificate Manager) |
| **DDoS Protection** | AWS Shield |
| **Web Application Firewall** | AWS WAF |

---

## 15. Interview Q&A

### Q1: What is the difference between a public and private IP address?

**Answer:** Public IPs are globally unique and routable on the internet. Private IPs are in reserved ranges (10.x.x.x, 172.16-31.x.x, 192.168.x.x) and not routable on the internet — they're only valid within a private network. Multiple private networks can use the same private IP ranges without conflict. Devices with private IPs access the internet through NAT (Network Address Translation), where a NAT device translates the private IP to a public IP for outbound connections.

---

### Q2: What does /24 mean in 192.168.1.0/24?

**Answer:** The /24 is CIDR notation indicating that the first 24 bits of the address are the network portion, and the remaining 8 bits are for hosts. This gives 2^8 = 256 addresses (192.168.1.0 through 192.168.1.255). In AWS, 5 addresses are reserved, leaving 251 usable. The formula for number of addresses is 2^(32 - prefix_length).

---

### Q3: How does DNS work?

**Answer:** When you type a domain name in a browser, a DNS resolution process happens:
1. Browser checks its cache
2. OS checks its cache and /etc/hosts
3. Query goes to the recursive resolver (often your ISP or 8.8.8.8)
4. Resolver asks a root nameserver which TLD server handles .com
5. Resolver asks the .com TLD server which authoritative server handles example.com
6. Resolver asks example.com's authoritative nameserver for the IP
7. IP is returned, cached with TTL, and the browser connects to the IP

---

### Q4: What is the difference between TCP and UDP?

**Answer:** TCP is connection-oriented and reliable — it establishes a connection with a three-way handshake, guarantees packet delivery (retransmits lost packets), ensures ordered delivery, and has error correction. UDP is connectionless and unreliable — no handshake, no guaranteed delivery, no ordering, but much lower overhead and latency. TCP is used for HTTP, SSH, databases where data integrity matters. UDP is used for DNS, video streaming, VoIP, gaming where speed matters more than reliability.

---

### Q5: What is a Security Group in AWS? How does it differ from a Network ACL?

**Answer:**
- **Security Groups** are stateful firewalls at the instance level. You define inbound rules; return traffic is automatically allowed. They only support Allow rules (no explicit Deny). All rules are evaluated.
- **Network ACLs** are stateless firewalls at the subnet level. Return traffic must be explicitly allowed. They support both Allow and Deny rules. Rules are evaluated in order, first match wins.

For most production use, Security Groups provide sufficient control. NACLs add an extra layer, useful for denying specific IP ranges at the subnet level.

---

### Q6: What is NAT and why do we need it?

**Answer:** NAT (Network Address Translation) allows devices with private IP addresses to communicate with the internet. Private IPs aren't routable on the internet, so when a private instance sends traffic outbound, the NAT device replaces the private source IP with its own public IP. When the response comes back to the public IP, NAT translates it back to the private IP and forwards it. In AWS, NAT Gateways are used to give private subnet EC2 instances outbound internet access (for software updates, API calls) without exposing them to inbound internet connections.

---

### Q7: What is the difference between a public and private subnet in AWS?

**Answer:** The difference is the route table. A public subnet has a route that directs internet-bound traffic (0.0.0.0/0) to an Internet Gateway — instances with public IPs can be reached from the internet. A private subnet routes internet-bound traffic to a NAT Gateway (outbound only) or has no internet route at all. Databases and application servers typically go in private subnets; load balancers and NAT gateways go in public subnets.

---

### Q8: What is HTTPS and why is it important?

**Answer:** HTTPS is HTTP with TLS (Transport Layer Security) encryption. It provides: (1) Encryption — data in transit is encrypted, preventing eavesdropping; (2) Authentication — SSL certificates verify the server's identity, preventing impersonation; (3) Integrity — data can't be tampered with in transit. HTTPS runs on port 443. It's critical for protecting user data (passwords, payment info), and it's now required by browsers (they show "Not Secure" warnings for HTTP). AWS ACM provides free SSL certificates for AWS services.

---

### Q9: How does a Load Balancer improve availability?

**Answer:** A load balancer improves availability in several ways: (1) Distributes traffic across multiple instances, so no single instance is overwhelmed; (2) Performs health checks on instances — if one becomes unhealthy, the LB stops sending traffic to it and continues routing to healthy instances; (3) Provides a single entry point (one DNS name), so clients don't need to know about individual instances; (4) Enables zero-downtime deployments by draining connections from old instances while routing new connections to updated instances. In AWS, an ALB across multiple AZs is a core HA pattern.

---

### Q10: What is the difference between an Application Load Balancer and Network Load Balancer in AWS?

**Answer:**
- **ALB (Layer 7):** Operates at the HTTP layer. Can route based on URL paths, HTTP headers, hostnames. Supports content-based routing. Terminates SSL. Used for web applications, microservices. Best choice for most web workloads.
- **NLB (Layer 4):** Operates at TCP/UDP level. Extremely low latency and high performance. Routes based on IP/port only. Preserves source IP. Best for high-performance, non-HTTP workloads, gaming, IoT, real-time applications.

Choose ALB for web apps; NLB for extreme performance requirements or TCP/UDP protocols.
