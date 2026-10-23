# Secrets — Complete Guide

## Table of Contents
1. [What is a Secret](#1-what-is-a-secret)
2. [Secret Types](#2-secret-types)
3. [Base64 Encoding — Not Encryption](#3-base64-encoding--not-encryption)
4. [Creating Secrets](#4-creating-secrets)
5. [Using Secrets as Environment Variables](#5-using-secrets-as-environment-variables)
6. [Using Secrets as Volume Mounts](#6-using-secrets-as-volume-mounts)
7. [imagePullSecrets](#7-imagepullsecrets)
8. [External Secrets Management](#8-external-secrets-management)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. What is a Secret

A **Secret** is a Kubernetes object designed to hold sensitive data such as passwords, OAuth tokens, SSH keys, and TLS certificates. Secrets are similar to ConfigMaps but intended specifically for confidential information and are handled with additional precautions by the Kubernetes control plane.

```
┌─────────────────────────────────────────────────────────────────┐
│                      Kubernetes Cluster                         │
│                                                                 │
│  ┌──────────────┐   etcd (encrypted at rest)                   │
│  │    Secret    │◀──────────────────────────────┐              │
│  │              │                               │              │
│  │ data:        │        ┌──────────────────────┴───────────┐  │
│  │  key: base64 │───────▶│             Pod                  │  │
│  │  key: base64 │        │  ┌────────────────────────────┐  │  │
│  └──────────────┘        │  │       Container            │  │  │
│                          │  │  ENV: DB_PASS=secret       │  │  │
│                          │  │  /etc/secrets/token        │  │  │
│                          │  └────────────────────────────┘  │  │
│                          └────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

Key differences from ConfigMaps:
- Secrets are stored encoded (base64) in etcd — and should be encrypted at rest via EncryptionConfiguration
- Kubernetes minimises the risk of accidental exposure: secrets are only sent to nodes that need them
- Secrets are stored in tmpfs (memory) on nodes, never written to disk
- RBAC policies should restrict who can read Secrets

---

## 2. Secret Types

Kubernetes has several built-in Secret types, each with a specific use case:

| Type | Usage |
|------|-------|
| `Opaque` | Arbitrary user-defined data (default type) |
| `kubernetes.io/tls` | TLS certificate and private key |
| `kubernetes.io/dockerconfigjson` | Credentials for a private Docker registry |
| `kubernetes.io/dockercfg` | Legacy Docker registry credentials |
| `kubernetes.io/service-account-token` | Service account token (auto-created) |
| `kubernetes.io/ssh-auth` | SSH private key |
| `kubernetes.io/basic-auth` | Username and password for basic authentication |
| `bootstrap.kubernetes.io/token` | Bootstrap token data |

```
Secret Types
┌─────────────────────────────────────────────────────┐
│  Opaque              → passwords, API keys, tokens   │
│  kubernetes.io/tls   → SSL/TLS cert + private key    │
│  dockerconfigjson    → private registry credentials  │
│  service-account     → auto-mounted in pods          │
│  ssh-auth            → SSH keys                      │
└─────────────────────────────────────────────────────┘
```

---

## 3. Base64 Encoding — Not Encryption

**Critical concept:** Kubernetes Secrets store values as base64-encoded strings. Base64 is an encoding scheme, NOT encryption. Anyone with access to the Secret object can trivially decode the values.

```bash
# Encoding a value to base64
echo -n "mysecretpassword" | base64
# bXlzZWNyZXRwYXNzd29yZA==

# Decoding base64 back to plaintext
echo "bXlzZWNyZXRwYXNzd29yZA==" | base64 --decode
# mysecretpassword
```

```
Base64 is NOT encryption:
┌───────────────────┐         ┌───────────────────────────┐
│ "mysecretpassword"│──base64─▶ "bXlzZWNyZXRwYXNzd29yZA=="│
└───────────────────┘         └───────────────────────────┘
                                        │
                               Anyone can reverse this!
                               base64 --decode ──────────▶ "mysecretpassword"
```

**To truly secure Secrets:**
1. Enable **encryption at rest** in etcd via `EncryptionConfiguration`
2. Use **RBAC** to restrict `get`/`list` on Secret resources
3. Enable **audit logging** for secret access
4. Consider external secret managers (AWS Secrets Manager, HashiCorp Vault)

---

## 4. Creating Secrets

### From Literals

```bash
# Create an Opaque secret with literal values
kubectl create secret generic db-credentials \
  --from-literal=username=admin \
  --from-literal=password=S3cur3P@ss!

# View the secret (values are base64 encoded)
kubectl get secret db-credentials -o yaml
```

### From Files

```bash
# Create files with secret values (no trailing newline with -n)
echo -n "admin" > username.txt
echo -n "S3cur3P@ss!" > password.txt

# Create secret from files
kubectl create secret generic db-credentials \
  --from-file=username=username.txt \
  --from-file=password=password.txt
```

### TLS Secret

```bash
# Generate a self-signed certificate (for testing)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout tls.key \
  -out tls.crt \
  -subj "/CN=myapp.example.com"

# Create TLS secret
kubectl create secret tls myapp-tls \
  --cert=tls.crt \
  --key=tls.key
```

### Docker Registry Secret

```bash
# Create a secret for a private Docker registry
kubectl create secret docker-registry registry-credentials \
  --docker-server=registry.example.com \
  --docker-username=myuser \
  --docker-password=mypassword \
  --docker-email=myuser@example.com
```

### From a YAML Manifest

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: db-credentials
  namespace: default
type: Opaque
data:
  # Values must be base64 encoded
  username: YWRtaW4=          # echo -n "admin" | base64
  password: UzNjdXIzUEBzcyE=  # echo -n "S3cur3P@ss!" | base64
```

```yaml
# Using stringData — Kubernetes auto-encodes these values
apiVersion: v1
kind: Secret
metadata:
  name: db-credentials
type: Opaque
stringData:
  username: admin             # Plain text — Kubernetes base64-encodes on apply
  password: "S3cur3P@ss!"    # Plain text
```

```bash
# Apply and verify
kubectl apply -f secret.yaml
kubectl describe secret db-credentials
# Note: kubectl describe does NOT show values — only key names and sizes
```

---

## 5. Using Secrets as Environment Variables

### Load a Specific Secret Key

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp-pod
spec:
  containers:
  - name: myapp
    image: myapp:1.0
    env:
    - name: DB_USERNAME
      valueFrom:
        secretKeyRef:
          name: db-credentials    # Secret name
          key: username           # Key inside the Secret
    - name: DB_PASSWORD
      valueFrom:
        secretKeyRef:
          name: db-credentials
          key: password
          optional: false         # Pod fails to start if secret is missing
```

### Load All Keys as Environment Variables

```yaml
spec:
  containers:
  - name: myapp
    image: myapp:1.0
    envFrom:
    - secretRef:
        name: db-credentials      # All keys become env vars
```

**Warning:** Loading all keys with `envFrom` can accidentally expose secrets if the application logs environment variables. Prefer explicit `valueFrom` references.

```bash
# Verify env vars (values visible in exec — be careful in production)
kubectl exec myapp-pod -- printenv DB_USERNAME
# admin
```

---

## 6. Using Secrets as Volume Mounts

Mounting secrets as volumes is generally preferred over environment variables because:
- The application can read secrets at runtime and respond to rotations
- Secrets never appear in `kubectl describe pod` output as env var values
- File permissions can be tightly controlled

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp-pod
spec:
  volumes:
  - name: db-secret-volume
    secret:
      secretName: db-credentials    # Reference the Secret
      defaultMode: 0400             # Read-only for owner only
  containers:
  - name: myapp
    image: myapp:1.0
    volumeMounts:
    - name: db-secret-volume
      mountPath: /etc/secrets       # Each key becomes a file here
      readOnly: true
```

```
Secret: db-credentials             Pod filesystem
┌──────────────────────┐          ┌──────────────────────────────┐
│ username: YWRtaW4=   │─────────▶│ /etc/secrets/username        │
│ password: UzNjdXIz.. │─────────▶│ /etc/secrets/password        │
└──────────────────────┘          │ (stored in tmpfs — memory)   │
                                  └──────────────────────────────┘
```

```bash
# Verify mounted secret files
kubectl exec myapp-pod -- ls /etc/secrets
# password  username

kubectl exec myapp-pod -- cat /etc/secrets/username
# admin
```

---

## 7. imagePullSecrets

When pulling images from a private container registry, you must provide registry credentials to the kubelet. Use `imagePullSecrets` in the pod spec or attach the secret to a ServiceAccount.

```bash
# Create the registry secret
kubectl create secret docker-registry registry-credentials \
  --docker-server=registry.example.com \
  --docker-username=myuser \
  --docker-password=mypassword
```

```yaml
# Reference in pod spec
apiVersion: v1
kind: Pod
metadata:
  name: private-app
spec:
  imagePullSecrets:
  - name: registry-credentials    # Use the Docker registry secret
  containers:
  - name: app
    image: registry.example.com/myapp:1.0
```

```bash
# Attach to a ServiceAccount so all pods in namespace use it
kubectl patch serviceaccount default \
  -p '{"imagePullSecrets": [{"name": "registry-credentials"}]}'
```

---

## 8. External Secrets Management

For production environments, Kubernetes Secrets alone are often insufficient. External secret managers provide rotation, audit trails, and true encryption.

```
External Secrets Architecture
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│  ┌─────────────────┐       ┌───────────────────────────────┐  │
│  │  External Store  │       │      Kubernetes Cluster       │  │
│  │                 │       │                               │  │
│  │ AWS Secrets Mgr │◀─────▶│  External Secrets Operator   │  │
│  │ HashiCorp Vault │       │         │                     │  │
│  │ Azure Key Vault │       │         ▼                     │  │
│  │ GCP Secret Mgr  │       │  Kubernetes Secret (synced)   │  │
│  └─────────────────┘       │         │                     │  │
│                            │         ▼                     │  │
│                            │        Pod                    │  │
│                            └───────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

### External Secrets Operator

The **External Secrets Operator (ESO)** synchronises secrets from external stores into Kubernetes Secrets.

```yaml
# ExternalSecret resource — fetches from AWS Secrets Manager
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: db-secret
spec:
  refreshInterval: 1h              # Sync every hour
  secretStoreRef:
    name: aws-secretsmanager
    kind: SecretStore
  target:
    name: db-credentials           # Name of resulting K8s Secret
    creationPolicy: Owner
  data:
  - secretKey: password            # Key in K8s Secret
    remoteRef:
      key: prod/myapp/db           # Path in AWS Secrets Manager
      property: password           # JSON property in the secret
```

### HashiCorp Vault Integration

```bash
# Install Vault agent injector (Helm)
helm repo add hashicorp https://helm.releases.hashicorp.com
helm install vault hashicorp/vault \
  --set "injector.enabled=true"
```

```yaml
# Pod annotations for Vault agent sidecar injection
apiVersion: v1
kind: Pod
metadata:
  annotations:
    vault.hashicorp.com/agent-inject: "true"
    vault.hashicorp.com/agent-inject-secret-db: "secret/data/db"
    vault.hashicorp.com/role: "myapp"
spec:
  containers:
  - name: myapp
    image: myapp:1.0
    # Secret injected at /vault/secrets/db by Vault agent sidecar
```

---

## 9. Hands-On Exercises

**Exercise 1:** Create an Opaque Secret named `app-secrets` using `stringData` with keys `api_key` and `jwt_secret`. Apply the manifest, then use `kubectl get secret app-secrets -o yaml` to observe that Kubernetes has automatically base64-encoded the values. Decode one value using `base64 --decode` to confirm the original value is recoverable.

**Exercise 2:** Create a pod that loads `api_key` from the `app-secrets` Secret as the environment variable `API_KEY` using `valueFrom.secretKeyRef`. Exec into the pod and run `printenv API_KEY` to verify the value. Then intentionally reference a non-existent secret key with `optional: false` and observe that the pod fails to start, showing the error in `kubectl describe pod`.

**Exercise 3:** Generate a self-signed TLS certificate using openssl. Create a `kubernetes.io/tls` Secret from the certificate and key. Write a pod manifest that mounts the TLS secret at `/etc/tls` with `defaultMode: 0400`. Exec into the pod and verify that `tls.crt` and `tls.key` files exist with the correct permissions.

**Exercise 4:** Create a private registry secret using `kubectl create secret docker-registry`. Create a pod manifest that references this secret via `imagePullSecrets`. Observe the pod events to see whether the image pull succeeds or fails (it will fail unless the registry is real, but the auth mechanism is demonstrated). Then patch the `default` ServiceAccount to include this `imagePullSecrets` so all pods in the namespace inherit it.

**Exercise 5:** Create an immutable Secret (`immutable: true`) with a database password. Attempt to update the password and observe the error. Create a new Secret with a new name containing the updated password, update a Deployment to reference the new Secret, apply the change, then delete the old Secret. Verify that the running pods are using the updated password.

---

## 10. Interview Q&A

**Q: What is the difference between a Kubernetes Secret and a ConfigMap?**
Answer: Both store key-value data, but Secrets are intended for sensitive information. Secrets are base64-encoded (not plain text), can be encrypted at rest in etcd with EncryptionConfiguration, are stored in tmpfs on nodes (never written to disk), are only sent to nodes that run pods needing them, and should be protected with strict RBAC policies. ConfigMaps store non-sensitive configuration in plain text with no special handling.

**Q: Is a Kubernetes Secret actually secure? What are its limitations?**
Answer: By default, Kubernetes Secrets have limited security. The values are only base64-encoded (not encrypted), so anyone with `kubectl get secret` permission can read them. etcd stores them in plaintext unless you explicitly configure EncryptionConfiguration. The main protections are RBAC (restricting who can access secrets), encryption at rest (requires setup), node isolation (secrets only sent to nodes that need them), and audit logging. For true security, use external secret managers like HashiCorp Vault or AWS Secrets Manager, which provide proper encryption, rotation, and audit trails.

**Q: When would you use a volume mount for a Secret vs an environment variable?**
Answer: Volume mounts are generally preferred for secrets because the values are never visible in `kubectl describe pod`, the application can detect file changes and reload secrets at runtime (useful for certificate rotation), and file permissions can be set to restrict access. Environment variables are simpler to use but can be accidentally logged by the application, are exposed in `kubectl describe pod` output (as key names, not values), and require a pod restart to pick up changes since they are injected at startup.

**Q: How do you rotate a Secret in Kubernetes without downtime?**
Answer: For volume-mounted secrets, update the Secret object — Kubernetes propagates the change to pod filesystems within the kubelet sync period (default 60 seconds), and if the application watches for file changes it can reload without a restart. For environment-variable-based secrets, you must restart the pods; use `kubectl rollout restart deployment` for a zero-downtime rolling restart. For immutable secrets, create a new Secret with a new name, update the Deployment spec to reference it, and apply the change — this triggers a rolling update automatically.

**Q: What is the External Secrets Operator and why would you use it?**
Answer: The External Secrets Operator (ESO) is a Kubernetes operator that reads secrets from external secret managers (AWS Secrets Manager, HashiCorp Vault, Azure Key Vault, GCP Secret Manager) and creates Kubernetes Secret objects from them. You would use it when you need centralised secret management across multiple clusters or services, automatic rotation and synchronisation, a full audit trail of secret access, compliance with security standards that require secrets never to be stored in Kubernetes etcd, and integration with existing enterprise secret management infrastructure.
