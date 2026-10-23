# AWS KMS: Key Management Service

## Table of Contents

1. [What is KMS?](#what-is-kms)
2. [Encryption Fundamentals](#encryption-fundamentals)
3. [KMS Key Types](#kms-key-types)
4. [Customer Managed Keys (CMKs)](#customer-managed-keys-cmks)
5. [Key Policies](#key-policies)
6. [Key Rotation](#key-rotation)
7. [Envelope Encryption](#envelope-encryption)
8. [KMS Integration with AWS Services](#kms-integration-with-aws-services)
9. [KMS API Operations](#kms-api-operations)
10. [CloudHSM](#cloudhsm)
11. [KMS vs CloudHSM](#kms-vs-cloudhsm)
12. [Hands-On: Creating a CMK and Encrypting Data](#hands-on-creating-a-cmk-and-encrypting-data)
13. [Interview Q&A](#interview-qa)

---

## What is KMS?

AWS Key Management Service (KMS) is a managed service that makes it easy to create and control the cryptographic keys used to encrypt and decrypt data. It integrates seamlessly with most AWS services and provides a centralised, auditable key management system.

### Why KMS Exists

The problem with encryption: you need to manage the keys.
- Where do you store the encryption key?
- How do you rotate keys?
- How do you track who used which key and when?
- How do you control who can encrypt vs who can decrypt?
- How do you ensure keys are stored in FIPS 140-2 validated hardware?

KMS solves all of these problems.

### What KMS Does

1. **Stores and manages cryptographic keys** in FIPS 140-2 Level 2 validated hardware security modules (HSMs)
2. **Performs cryptographic operations** (encrypt, decrypt, sign, verify) on your behalf — the key material NEVER leaves the HSM in plaintext
3. **Integrates with AWS services** to encrypt data at rest without you managing keys manually
4. **Logs every key usage** to AWS CloudTrail — you can see who used which key, when, and for what
5. **Controls key access** via key policies and IAM policies
6. **Rotates keys** automatically or on demand

### KMS Scope

- Regional service — keys in us-east-1 cannot be used to decrypt data in eu-west-1 (unless you use multi-Region keys)
- Maximum 4 KB of data can be encrypted directly (larger data uses envelope encryption)
- All KMS API calls are logged to CloudTrail automatically

---

## Encryption Fundamentals

### Symmetric vs Asymmetric Encryption

**Symmetric encryption:**
- The SAME key is used for both encryption and decryption
- Faster, suitable for large amounts of data
- Challenge: key distribution (how do you securely share the key?)
- Example algorithms: AES-256, AES-128

**Asymmetric encryption:**
- A KEY PAIR: public key (encrypt) + private key (decrypt)
- Anyone can encrypt with the public key, only the private key holder can decrypt
- Slower, typically used for key exchange or small amounts of data
- Example algorithms: RSA-2048, RSA-4096, ECDSA

KMS supports both, but for most encryption at rest use cases, you will use symmetric (AES-256-GCM).

---

## KMS Key Types

AWS KMS offers three tiers of keys based on who controls the key material:

### 1. Customer Managed Keys (CMKs)

Keys you create and manage in KMS:
- You control the key policy (who can use the key)
- You can enable/disable the key
- You can schedule key deletion (7-30 day waiting period)
- You pay $1/month per key + $0.03 per 10,000 API calls
- You can enable automatic rotation
- Audit trail available via CloudTrail

### 2. AWS Managed Keys

Keys created by AWS on your behalf when you enable encryption in a service:
- Naming format: `aws/s3`, `aws/rds`, `aws/ebs`, `aws/lambda`, etc.
- You can view them but CANNOT delete, disable, or modify their key policies
- AWS rotates them automatically every year
- No charge for the key itself (service charges for API calls)
- Audit trail available via CloudTrail

### 3. AWS Owned Keys

Keys owned and managed entirely by AWS, shared across multiple customers:
- You cannot see them or manage them
- Used by some services "under the hood"
- No cost
- No CloudTrail visibility for your usage (AWS doesn't log these per-customer)
- Examples: DynamoDB default encryption, S3 SSE-S3 (AES-256 without KMS)

### Comparison Table

| Feature | Customer Managed | AWS Managed | AWS Owned |
|---------|-----------------|-------------|-----------|
| Who creates it | You | AWS (for a service) | AWS |
| You can view it | Yes | Yes | No |
| You can manage key policy | Yes | No | No |
| Can be disabled/deleted | Yes | No | No |
| Rotation control | You control (optional or required by policy) | AWS rotates yearly | AWS manages |
| CloudTrail logging | Yes | Yes | No |
| Cost | $1/month + API costs | No key cost | No cost |
| Use case | Sensitive data requiring audit/control | Default for managed services | Background AWS operations |

---

## Customer Managed Keys (CMKs)

### Creating a CMK

A CMK has:
- **Key ID**: A UUID (e.g., `1234abcd-12ab-34cd-56ef-1234567890ab`)
- **Key ARN**: `arn:aws:kms:us-east-1:123456789012:key/1234abcd-...`
- **Alias**: A friendly name (e.g., `alias/my-database-key`)
- **Key material**: The actual cryptographic material (stored in HSMs, NEVER exported in plaintext)
- **Key state**: Enabled, Disabled, PendingDeletion, PendingImport, Unavailable
- **Key policy**: JSON resource policy controlling access

### CMK Key States

```
ENABLED    --> Key is active and can be used for cryptographic operations
    |
    | (disable)
    v
DISABLED   --> Key exists but cannot be used. Data encrypted with it is inaccessible.
    |          Can be re-enabled.
    |
    | (schedule deletion: 7-30 day waiting period)
    v
PENDING    --> Key is scheduled for deletion. Cannot be used.
DELETION   --> If you cancel, returns to Disabled state.
    |
    | (waiting period expires)
    v
DELETED    --> Key is permanently gone. Data encrypted ONLY with this key
               is permanently unrecoverable.
```

> WARNING: Deleting a KMS key is irreversible after the waiting period. Always ensure you have a backup or that no critical data is encrypted ONLY with this key before deletion.

### Key Aliases

An alias is a friendly name for a CMK. Using aliases is best practice because:
- Code references the alias (`alias/prod-database-key`) instead of the key ID
- When you rotate to a new key, just update the alias to point to the new key — no code changes required

```bash
# Create an alias
aws kms create-alias \
    --alias-name alias/prod-database-key \
    --target-key-id 1234abcd-12ab-34cd-56ef-1234567890ab

# Reference by alias in application code
aws kms encrypt \
    --key-id alias/prod-database-key \
    --plaintext "sensitive data"
```

---

## Key Policies

### What is a Key Policy?

Every KMS key has a **key policy** — a JSON resource policy that defines who can use and manage the key. Unlike IAM policies, the key policy is the PRIMARY access control mechanism for KMS keys.

Important: **If you don't specify a key policy, the key is inaccessible even to account administrators!** (Unlike most resources where account admins have implicit access.)

### Default Key Policy (Console)

When you create a CMK via the Console without specifying a custom policy, it creates this default:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "Enable IAM User Permissions",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::123456789012:root"
      },
      "Action": "kms:*",
      "Resource": "*"
    }
  ]
}
```

This gives the account root all KMS permissions, which then allows IAM policies to further delegate access. This is the recommended starting point.

### Controlling Key Access

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowAccountRootFullAccess",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::123456789012:root"
      },
      "Action": "kms:*",
      "Resource": "*"
    },
    {
      "Sid": "AllowKeyAdmins",
      "Effect": "Allow",
      "Principal": {
        "AWS": [
          "arn:aws:iam::123456789012:role/KeyAdminRole",
          "arn:aws:iam::123456789012:user/alice"
        ]
      },
      "Action": [
        "kms:Create*",
        "kms:Describe*",
        "kms:Enable*",
        "kms:List*",
        "kms:Put*",
        "kms:Update*",
        "kms:Revoke*",
        "kms:Disable*",
        "kms:Get*",
        "kms:Delete*",
        "kms:TagResource",
        "kms:UntagResource",
        "kms:ScheduleKeyDeletion",
        "kms:CancelKeyDeletion"
      ],
      "Resource": "*"
    },
    {
      "Sid": "AllowKeyUsers",
      "Effect": "Allow",
      "Principal": {
        "AWS": [
          "arn:aws:iam::123456789012:role/EC2AppRole",
          "arn:aws:iam::123456789012:role/LambdaRole"
        ]
      },
      "Action": [
        "kms:Encrypt",
        "kms:Decrypt",
        "kms:ReEncrypt*",
        "kms:GenerateDataKey*",
        "kms:DescribeKey"
      ],
      "Resource": "*"
    },
    {
      "Sid": "AllowCrossAccountAccess",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::999999999999:root"
      },
      "Action": [
        "kms:Decrypt",
        "kms:DescribeKey"
      ],
      "Resource": "*"
    }
  ]
}
```

### Key Policy vs IAM Policy for KMS

To use a KMS key, a principal needs permission from BOTH:
1. The **key policy** must allow the principal
2. The **IAM policy** on the principal must allow the KMS actions

Exception: If the key policy includes the "Enable IAM User Permissions" statement (granting root), then IAM policies alone are sufficient for principals in that account.

---

## Key Rotation

### Automatic Key Rotation

For CMKs using AWS-generated key material:
- Enable automatic rotation: KMS generates new key material every year
- The old key material is RETAINED (needed to decrypt data encrypted with it)
- New encryptions use the new key material
- Decryptions automatically use the correct key material based on metadata in the ciphertext
- The key ID, ARN, and alias DON'T CHANGE — rotation is transparent to your application

```bash
# Enable automatic rotation
aws kms enable-key-rotation --key-id 1234abcd-...

# Check rotation status
aws kms get-key-rotation-status --key-id 1234abcd-...
```

### Manual Key Rotation

If you need more control (rotate more frequently, use imported key material):
1. Create a new CMK
2. Re-encrypt all data with the new CMK (or just update the alias to point to new key)
3. The old CMK remains to decrypt any data encrypted with it until all data is re-encrypted
4. Eventually disable/delete the old key

### Re-Encryption

KMS provides a `re-encrypt` operation that decrypts ciphertext with the old key and re-encrypts with a new key in a single API call — the plaintext NEVER leaves KMS:

```bash
aws kms re-encrypt \
    --ciphertext-blob fileb://encrypted-file \
    --destination-key-id alias/new-key \
    --source-key-id alias/old-key
```

---

## Envelope Encryption

### The Problem: KMS Can Only Encrypt 4 KB

The KMS `Encrypt` API call has a hard limit of **4,096 bytes** (4 KB) of plaintext per call. You cannot directly encrypt a 1 GB database backup with KMS.

### The Solution: Envelope Encryption

Envelope encryption uses two levels of keys:
1. **Data Encryption Key (DEK)**: A symmetric key that encrypts the actual data (can be any size)
2. **Key Encryption Key (KEK)**: The KMS CMK that encrypts the DEK

The DEK does the heavy lifting. The CMK only ever encrypts the small DEK.

### Envelope Encryption: Step-by-Step

#### Encryption Process

```
Step 1: Call KMS GenerateDataKey API
    Request: "Give me a data key encrypted with CMK alias/my-key"
    
    KMS returns TWO things:
        a) Plaintext DEK (a random 256-bit AES key, used NOW to encrypt, then discarded)
        b) Encrypted DEK (the same DEK, but encrypted with your CMK — store this)

Step 2: Encrypt your data locally
    Use the PLAINTEXT DEK (from step 1a) to encrypt your data
    This happens LOCALLY in your application — very fast, no KMS API call needed
    Result: Encrypted data

Step 3: Discard the plaintext DEK from memory
    You now have:
        - Encrypted data (result of step 2)
        - Encrypted DEK (from step 1b)
    Store BOTH together (e.g., prepend encrypted DEK to encrypted data)
    
    The plaintext key never touches disk.
```

#### Decryption Process

```
Step 1: Separate the encrypted DEK from the encrypted data
    (You stored them together, so split them apart)

Step 2: Call KMS Decrypt API with the encrypted DEK
    Request: "Decrypt this encrypted DEK"
    KMS uses the CMK to decrypt the DEK and returns the PLAINTEXT DEK
    
    Note: You need Decrypt permission on the CMK in the key policy AND IAM policy

Step 3: Decrypt your data locally
    Use the plaintext DEK to decrypt the encrypted data
    Discard the plaintext DEK from memory

Result: Original plaintext data
```

### Diagram

```
ENCRYPTION:
                                        +----------+
Plaintext Data (any size)               | KMS CMK  |
      |                                 | (in HSM) |
      |                          -----> +----------+
      |                         |            |
      |              GenerateDataKey API      | Encrypted DEK
      |                         |            v
      |                    Plaintext DEK --> +--------------------+
      |                         |           | Envelope (stored): |
      v                         |           | [Encrypted DEK]    |
[Local AES-256                  v           | [Encrypted Data]   |
 Encrypt]---> Encrypted Data ------>        +--------------------+
      ^
      |
 Plaintext DEK (discard after use)


DECRYPTION:
+--------------------+
| Envelope:          |      +----------+
| [Encrypted DEK] ---+----> | KMS CMK  | ---> Plaintext DEK
| [Encrypted Data]   |      | (in HSM) |            |
+--------------------+      +----------+            v
                                            [Local AES-256
                                             Decrypt]
                                                    |
                                                    v
                                             Plaintext Data
```

### GenerateDataKey vs GenerateDataKeyWithoutPlaintext

- `GenerateDataKey`: Returns BOTH plaintext DEK and encrypted DEK. Use when encrypting data right now.
- `GenerateDataKeyWithoutPlaintext`: Returns ONLY the encrypted DEK. Use for deferred encryption (queue a job that will encrypt later).

---

## KMS Integration with AWS Services

### S3

Three modes of server-side encryption:

| Mode | Key management | KMS involvement | Cost |
|------|---------------|-----------------|------|
| SSE-S3 | AWS manages, AWS Owned Key | None (S3 uses its own keys) | Free |
| SSE-KMS | You choose CMK or aws/s3 | KMS called for every object | $0.03 per 10K requests |
| SSE-C | You provide key per request | None (you do it yourself) | Free (but complex) |
| DSSE-KMS | Double-layer KMS (two CMKs) | Two KMS calls per object | Higher cost |

For sensitive data, use SSE-KMS with your own CMK to control who can decrypt.

```bash
# Upload an object with SSE-KMS
aws s3 cp myfile.txt s3://my-bucket/myfile.txt \
    --sse aws:kms \
    --sse-kms-key-id alias/my-s3-key

# Enforce SSE-KMS on a bucket via bucket policy:
{
  "Effect": "Deny",
  "Principal": "*",
  "Action": "s3:PutObject",
  "Resource": "arn:aws:s3:::my-bucket/*",
  "Condition": {
    "StringNotEquals": {
      "s3:x-amz-server-side-encryption": "aws:kms"
    }
  }
}
```

### EBS

EBS volumes can be encrypted at creation:
- Uses CMK (default `aws/ebs` or your own CMK)
- Encryption is transparent — the EC2 instance reads/writes unencrypted data through the hypervisor; KMS encryption/decryption happens between the hypervisor and the EBS disk
- Encrypted snapshots, encrypted AMIs (launched from encrypted snapshots are also encrypted)
- Cannot encrypt an existing unencrypted volume directly — must: create snapshot → copy with encryption → create new volume from snapshot

```bash
# Create encrypted EBS volume
aws ec2 create-volume \
    --availability-zone ap-southeast-2a \
    --size 100 \
    --encrypted \
    --kms-key-id alias/my-ebs-key
```

### RDS

RDS encryption:
- Must be enabled AT CREATION time (cannot encrypt an existing unencrypted RDS instance without snapshot restore)
- Encrypts the database storage, automated backups, read replicas, and snapshots
- Uses CMK (default `aws/rds` or your own)
- Aurora encryption works the same way

### Lambda

Lambda environment variables can be encrypted at rest using KMS:
- Default encryption uses `aws/lambda`
- You can use your own CMK
- Can also encrypt environment variables in transit (Lambda decrypts before passing to your code)

### Secrets Manager

Secrets Manager uses KMS to encrypt secrets at rest — always encrypted, using `aws/secretsmanager` by default, or your own CMK.

### Other Integrations

- **DynamoDB**: Table-level encryption (default aws-owned, optional CMK)
- **SNS**: Message encryption at rest
- **SQS**: Message encryption at rest
- **CloudTrail**: Log file encryption
- **CodeBuild**: Build artifact encryption
- **Glue**: Data catalog and job bookmark encryption

---

## KMS API Operations

### Most Important KMS API Calls

| API | Description | Typical Caller |
|-----|-------------|---------------|
| `kms:Encrypt` | Encrypts up to 4KB of plaintext | Your application (for small data) |
| `kms:Decrypt` | Decrypts KMS ciphertext | Your application |
| `kms:GenerateDataKey` | Returns plaintext + encrypted DEK | Your application (envelope encryption) |
| `kms:GenerateDataKeyWithoutPlaintext` | Returns only encrypted DEK | Deferred encryption |
| `kms:ReEncrypt` | Decrypt + re-encrypt under different key (plaintext never leaves KMS) | Key rotation workflows |
| `kms:DescribeKey` | View key metadata | Auditing, validation |
| `kms:CreateKey` | Create a new CMK | Admin |
| `kms:ScheduleKeyDeletion` | Schedule key for deletion | Admin |
| `kms:EnableKeyRotation` | Enable automatic rotation | Admin |
| `kms:ListKeys` | List all keys | Admin |
| `kms:Sign` | Sign a message (asymmetric key) | JWT, code signing |
| `kms:Verify` | Verify a signature | JWT, code signing |

---

## CloudHSM

### What is CloudHSM?

AWS CloudHSM provides dedicated **Hardware Security Modules (HSMs)** — single-tenant, dedicated hardware for your cryptographic key storage. You have exclusive use of the hardware.

CloudHSM gives you:
- **Single-tenant HSM**: Not shared with other AWS customers
- **FIPS 140-2 Level 3 validation** (KMS is Level 2)
- **Full control**: AWS cannot access the key material; if you lose your credentials, keys are unrecoverable
- **Custom key store**: You can create a KMS custom key store backed by CloudHSM — combining KMS API convenience with CloudHSM security
- **Industry-specific HSM operations**: TLS offloading, database Transparent Data Encryption (TDE), certificate authority operations

### How CloudHSM Works

```
Your Application
    |
    | (PKCS#11, JCE, OpenSSL Dynamic Engine APIs)
    v
CloudHSM Client (runs on your EC2 instance)
    |
    | (encrypted connection over VPC)
    v
CloudHSM Cluster (2+ HSMs in different AZs for HA)
    |
    +-- HSM 1 (AZ a): Physical Thales/SafeNet hardware
    +-- HSM 2 (AZ b): Physical Thales/SafeNet hardware
```

### CloudHSM Cluster

- Minimum 2 HSMs recommended (for HA)
- HSMs automatically synchronize key material within a cluster
- Located inside your VPC
- You are responsible for HA configuration and backup

---

## KMS vs CloudHSM

| Feature | KMS | CloudHSM |
|---------|-----|----------|
| Hardware | Multi-tenant HSMs (AWS-managed) | Single-tenant, dedicated hardware |
| FIPS Level | 140-2 Level 2 | 140-2 Level 3 |
| AWS access to keys | AWS can access for management purposes | AWS has NO access (zero-knowledge) |
| Integration | Native AWS service integration (S3, RDS, EBS, etc.) | Must use PKCS#11, JCE, or OpenSSL |
| Management | Fully managed by AWS | You manage cluster, backups |
| Key recovery if you lose access | AWS can help (they have management access) | IMPOSSIBLE — keys are gone forever |
| Cost | $1/key/month + $0.03/10K API calls | ~$1.60/HSM/hour (~$1,150/month) |
| Use case | Standard encryption for AWS services | Regulatory/compliance requirements, custom crypto |
| Availability | Always available (AWS managed) | You configure HA |
| AWS service integration | Seamless | Requires custom key store |

### When to Use CloudHSM Instead of KMS

- Regulations require FIPS 140-2 Level 3 (rather than Level 2)
- Regulations or contracts prohibit multi-tenant key storage
- You need to perform cryptographic operations not supported by KMS (e.g., TLS offloading, Oracle TDE)
- You require zero-knowledge architecture (not even AWS can access your keys)
- You need to use PKCS#11 directly

---

## Hands-On: Creating a CMK and Encrypting Data

### Task 1: Create a CMK via CLI

```bash
# Create a symmetric CMK for general use
KEY_ID=$(aws kms create-key \
    --description "My application encryption key" \
    --key-usage ENCRYPT_DECRYPT \
    --origin AWS_KMS \
    --query 'KeyMetadata.KeyId' \
    --output text)

echo "Created key: $KEY_ID"

# Create an alias for the key
aws kms create-alias \
    --alias-name alias/my-app-key \
    --target-key-id $KEY_ID

# Enable automatic rotation
aws kms enable-key-rotation --key-id $KEY_ID

# Verify key details
aws kms describe-key --key-id alias/my-app-key
```

### Task 2: Encrypt and Decrypt Data

```bash
# Encrypt a small piece of data (< 4KB)
CIPHERTEXT=$(aws kms encrypt \
    --key-id alias/my-app-key \
    --plaintext "Hello, this is my secret data" \
    --query 'CiphertextBlob' \
    --output text)

echo "Encrypted: $CIPHERTEXT"

# Decrypt the ciphertext
PLAINTEXT=$(aws kms decrypt \
    --ciphertext-blob $CIPHERTEXT \
    --query 'Plaintext' \
    --output text | base64 --decode)

echo "Decrypted: $PLAINTEXT"
```

### Task 3: Envelope Encryption (Python)

```python
import boto3
import base64
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

kms = boto3.client('kms', region_name='ap-southeast-2')
KEY_ALIAS = 'alias/my-app-key'

def encrypt_large_data(plaintext: str) -> dict:
    """Encrypt data of any size using envelope encryption."""
    
    # Step 1: Generate a data key
    response = kms.generate_data_key(
        KeyId=KEY_ALIAS,
        KeySpec='AES_256'
    )
    
    plaintext_key = response['Plaintext']          # Use for encryption, then discard
    encrypted_key = response['CiphertextBlob']     # Store alongside encrypted data
    
    # Step 2: Encrypt the data locally with the plaintext DEK
    nonce = os.urandom(12)  # 12 bytes for AES-GCM
    aesgcm = AESGCM(plaintext_key)
    
    plaintext_bytes = plaintext.encode('utf-8')
    encrypted_data = aesgcm.encrypt(nonce, plaintext_bytes, None)
    
    # Step 3: Discard the plaintext key (let it be garbage collected)
    del plaintext_key
    
    return {
        'encrypted_key': base64.b64encode(encrypted_key).decode(),
        'nonce': base64.b64encode(nonce).decode(),
        'encrypted_data': base64.b64encode(encrypted_data).decode()
    }


def decrypt_large_data(envelope: dict) -> str:
    """Decrypt envelope-encrypted data."""
    
    encrypted_key = base64.b64decode(envelope['encrypted_key'])
    nonce = base64.b64decode(envelope['nonce'])
    encrypted_data = base64.b64decode(envelope['encrypted_data'])
    
    # Step 1: Decrypt the DEK using KMS
    response = kms.decrypt(CiphertextBlob=encrypted_key)
    plaintext_key = response['Plaintext']
    
    # Step 2: Decrypt the data locally
    aesgcm = AESGCM(plaintext_key)
    plaintext_bytes = aesgcm.decrypt(nonce, encrypted_data, None)
    
    del plaintext_key
    
    return plaintext_bytes.decode('utf-8')


# Usage
large_text = "A" * 100_000  # 100KB of data — impossible to encrypt directly with KMS

envelope = encrypt_large_data(large_text)
print("Encrypted envelope keys:", list(envelope.keys()))

recovered = decrypt_large_data(envelope)
print("Decryption successful:", recovered == large_text)
```

### Task 4: Tag a Key and View Key Policy

```bash
# Add tags to a key
aws kms tag-resource \
    --key-id alias/my-app-key \
    --tags TagKey=Environment,TagValue=Production \
           TagKey=Application,TagValue=MyApp

# View the key policy
aws kms get-key-policy \
    --key-id alias/my-app-key \
    --policy-name default

# Update the key policy
aws kms put-key-policy \
    --key-id alias/my-app-key \
    --policy-name default \
    --policy file://key-policy.json
```

---

## Interview Q&A

### Q1: What is AWS KMS and why is it used?

**Answer:** AWS KMS is a managed service for creating, managing, and using cryptographic keys. It is used because: (1) storing key material securely (in FIPS 140-2 Level 2 validated HSMs); (2) all KMS usage is logged to CloudTrail providing an audit trail; (3) centralized control over who can use which keys; (4) seamless integration with 100+ AWS services; (5) managed rotation, no need to build your own key management infrastructure.

### Q2: What are the three types of KMS keys?

**Answer:**
1. **Customer Managed Keys (CMKs)**: You create and control — key policy, rotation, deletion. $1/month per key.
2. **AWS Managed Keys**: Created by AWS services automatically when you enable encryption (e.g., `aws/s3`, `aws/rds`). You can view but not modify them.
3. **AWS Owned Keys**: Fully managed by AWS, shared across customers, not visible to you. Used for background AWS service encryption.

### Q3: What is envelope encryption and why is it used?

**Answer:** Envelope encryption is a technique for encrypting large amounts of data using KMS, which has a 4KB encryption limit. It works by: (1) calling KMS `GenerateDataKey` to get a data encryption key (DEK) — KMS returns both a plaintext copy and an encrypted copy; (2) using the plaintext DEK to encrypt the actual data locally (fast, no size limit); (3) storing the encrypted DEK alongside the encrypted data; (4) discarding the plaintext DEK. Decryption reverses this: call KMS `Decrypt` to get the plaintext DEK, then decrypt data locally. The plaintext DEK never touches disk.

### Q4: What is the difference between KMS and CloudHSM?

**Answer:** KMS uses multi-tenant, AWS-managed HSMs (FIPS 140-2 Level 2). CloudHSM provides dedicated, single-tenant physical HSMs in your VPC (FIPS 140-2 Level 3). Key differences: with KMS, AWS manages the hardware and has management-level access to keys; with CloudHSM, AWS has zero access to keys and you manage the cluster. CloudHSM costs ~$1,150/month vs $1/key/month for KMS. Use CloudHSM when regulations require Level 3 FIPS, single-tenant hardware, or zero-knowledge architecture.

### Q5: How does automatic key rotation work in KMS?

**Answer:** When enabled, KMS generates new key material for the CMK every year. The OLD key material is retained indefinitely (needed to decrypt data previously encrypted with it). The KEY ID, ARN, and ALIASES remain the same — rotation is completely transparent to applications. New encryptions use the new material; decryptions automatically select the correct material based on metadata in the ciphertext. You cannot control the rotation interval beyond the annual period for automatic rotation; for custom intervals, use manual rotation.

### Q6: What happens if you delete a KMS key?

**Answer:** When you schedule a CMK for deletion (with a mandatory 7-30 day waiting period), after the waiting period expires the key is permanently deleted. Any data encrypted ONLY with that key becomes permanently unrecoverable. This is irreversible. Best practices: (1) use the waiting period to verify no active data depends on the key; (2) set up CloudWatch alarms to alert if anyone tries to use the key during the waiting period; (3) consider disabling the key first and monitoring before scheduling deletion.

### Q7: What is a KMS key policy and how is it different from an IAM policy for KMS?

**Answer:** A key policy is a resource-based policy attached to the KMS key itself that defines who can use and manage the key. For a principal to use a CMK: (1) the key policy must allow the principal, AND (2) the principal's IAM policy must allow the KMS action. Exception: if the key policy includes the "Enable IAM User Permissions" statement (granting the account root), then IAM policies alone can grant access without further key policy changes.

### Q8: How do you grant another AWS account access to your KMS key?

**Answer:** Two steps are required for cross-account KMS access: (1) Add the external account (or role in that account) as a principal in the KEY POLICY of your CMK with the required KMS actions; (2) The IAM identity in the external account must have an IAM policy allowing the KMS actions on the specific key ARN. Both permissions are required simultaneously.

### Q9: What is the difference between KMS Encrypt and GenerateDataKey?

**Answer:**
- `kms:Encrypt`: Takes your plaintext (max 4KB) and returns KMS ciphertext. KMS does the encryption inside its HSM.
- `kms:GenerateDataKey`: Generates a random data encryption key (DEK). Returns both the plaintext DEK and the same DEK encrypted with your CMK. You encrypt large data locally with the plaintext DEK. Used for envelope encryption.

Use `Encrypt` for small amounts of data or metadata. Use `GenerateDataKey` for encrypting data of any size (envelope encryption pattern).

### Q10: How does S3 SSE-KMS work?

**Answer:** When you upload an object to S3 with SSE-KMS: S3 calls `kms:GenerateDataKey` using your specified CMK, gets a plaintext DEK and encrypted DEK, uses the plaintext DEK to encrypt the object, stores the encrypted DEK alongside the object, and discards the plaintext DEK. On download: S3 retrieves the encrypted DEK from object metadata, calls `kms:Decrypt` to get the plaintext DEK, decrypts the object, and returns the plaintext to you. The requester needs both S3 read permissions AND `kms:Decrypt` permission on the CMK. Every S3 GET/PUT with SSE-KMS results in a KMS API call (cost consideration for high-throughput buckets).
