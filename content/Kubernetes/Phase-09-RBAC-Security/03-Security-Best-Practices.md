# Kubernetes Security Best Practices — Complete Guide

## Table of Contents
1. [Pod Security Standards](#1-pod-security-standards)
2. [securityContext Deep Dive](#2-securitycontext-deep-dive)
3. [Admission Controllers](#3-admission-controllers)
4. [Image Security](#4-image-security)
5. [Network Security](#5-network-security)
6. [Secrets Management](#6-secrets-management)
7. [CIS Benchmark Highlights](#7-cis-benchmark-highlights)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Pod Security Standards

**Pod Security Standards (PSS)** replaced the deprecated PodSecurityPolicy in Kubernetes 1.25. They define three security profiles that control what a Pod is allowed to do. Enforcement is applied at the namespace level via labels.

### The Three Profiles

```
Privileged  ─── no restrictions ──► fully unrestricted, equivalent to no policy
                                     Use only for: system-level workloads,
                                     privileged daemons (node-level monitoring)

Baseline    ─── minimal restrictions ──► prevents known privilege escalation
                                          blocks: hostNetwork, hostPID, hostIPC
                                          blocks: privileged containers
                                          blocks: hostPath volumes (most)
                                          allows: running as root, no seccomp

Restricted  ─── hardened ──► follows current pod hardening best practices
                              requires: runAsNonRoot: true
                              requires: drop ALL capabilities
                              requires: allowPrivilegeEscalation: false
                              requires: seccomp RuntimeDefault or Localhost
                              blocks: all hostPath, hostNetwork, hostPID, hostIPC
```

### Applying PSS to a Namespace

PSS is enforced via namespace labels with three modes per profile:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    # enforce: blocks non-compliant Pods (they fail to create)
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/enforce-version: latest

    # audit: logs non-compliant Pods but allows them to create
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/audit-version: latest

    # warn: returns a warning to kubectl but allows Pod creation
    pod-security.kubernetes.io/warn: restricted
    pod-security.kubernetes.io/warn-version: latest
```

```
Three modes:
  enforce: Pod creation is REJECTED if it violates the policy
           Use in production after verifying workloads are compliant
  audit:   Violations are logged to the audit log, Pod is allowed
           Use to discover non-compliant workloads without breaking them
  warn:    kubectl shows a warning, Pod is allowed
           Use during migration to alert developers without blocking deploys
```

### Profile Comparison Table

| Feature | Privileged | Baseline | Restricted |
|---------|-----------|----------|------------|
| Privileged containers | Allowed | Blocked | Blocked |
| hostNetwork/hostPID/hostIPC | Allowed | Blocked | Blocked |
| hostPath volumes | Allowed | Blocked (most) | Blocked |
| Running as root | Allowed | Allowed | Blocked |
| Privilege escalation | Allowed | Allowed | Blocked |
| Capabilities (CAP_*) | Allowed | Blocked (dangerous) | Must drop ALL |
| seccomp profile | Optional | Optional | Required |

---

## 2. securityContext Deep Dive

`securityContext` sets Linux security options for a Pod or individual container. It maps directly to Linux kernel primitives: user IDs, capabilities, seccomp, and filesystem flags.

### Pod-level vs Container-level

```
spec.securityContext:
  Applies to ALL containers in the Pod.
  Controls: runAsUser, runAsGroup, fsGroup, supplementalGroups, sysctls

spec.containers[*].securityContext:
  Applies to ONE container only.
  Can override the Pod-level setting.
  Controls: all of the above PLUS:
    allowPrivilegeEscalation, privileged, capabilities, readOnlyRootFilesystem, seccompProfile
```

### Full Hardened securityContext

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: hardened-app
spec:
  # Pod-level security context
  securityContext:
    runAsNonRoot: true          # fail to start if image runs as root (UID 0)
    runAsUser: 1000             # run all containers as UID 1000
    runAsGroup: 3000            # run all containers with GID 3000
    fsGroup: 2000               # volumes are owned by GID 2000, writable by the container
    seccompProfile:
      type: RuntimeDefault      # use the container runtime's default seccomp profile

  containers:
  - name: app
    image: myapp:1.0
    # Container-level security context
    securityContext:
      allowPrivilegeEscalation: false   # process cannot gain more privileges than parent
      readOnlyRootFilesystem: true      # container's root fs is read-only
      runAsNonRoot: true                # redundant but explicit — belt and suspenders
      capabilities:
        drop:
        - ALL                           # drop every Linux capability
        add:
        - NET_BIND_SERVICE              # re-add only what's needed (bind ports < 1024)
      seccompProfile:
        type: RuntimeDefault
```

### Key securityContext Fields Explained

```
runAsNonRoot: true
  → Pod fails to start if the container's image specifies USER 0 (root) in the Dockerfile
  → Protects against images accidentally running as root

runAsUser: 1000
  → The process inside the container runs with this UID
  → File access permissions apply as if this user owns the process

readOnlyRootFilesystem: true
  → The container's root filesystem is mounted read-only
  → Attackers who get code execution cannot write persistent files to the image
  → If your app needs to write files, use an explicit emptyDir or PVC volume mount

allowPrivilegeEscalation: false
  → Prevents a process from calling setuid binaries or gaining more privileges
  → Blocks exploits that rely on sudo or setuid to escalate from a low-privilege shell

capabilities:
  drop: [ALL]
  → Linux capabilities (NET_ADMIN, SYS_PTRACE, etc.) are dropped entirely
  → Containers run with no special kernel privileges
  add: [NET_BIND_SERVICE]
  → Selectively re-add only what is required
  → Common adds: NET_BIND_SERVICE (port < 1024), CHOWN, SETUID, SETGID

fsGroup: 2000
  → Volumes mounted into the Pod are owned by this supplemental group
  → Container processes can read/write the volume because they belong to that group
  → Important for StatefulSet volumes where the container runs as a non-root user
```

### seccompProfile

```
seccomp restricts which system calls the container process can make.

type: RuntimeDefault
  → Uses the container runtime's (containerd's) built-in syscall allowlist
  → Blocks ~300 of the most dangerous syscalls
  → Safe default for most workloads

type: Localhost
  → Uses a custom seccomp profile file on the node
  → Fine-grained control over allowed syscalls
  → Use for high-security workloads after profiling

type: Unconfined
  → No seccomp restriction (default if not set)
  → Container can make any syscall
  → Avoid in production
```

---

## 3. Admission Controllers

**Admission controllers** are plugins that intercept API server requests after authentication and authorization but before the object is persisted to etcd. They can validate, mutate, or reject requests.

### The Request Pipeline

```
kubectl apply -f pod.yaml
       │
       ▼
API Server receives request
       │
       ▼
Authentication  (who are you? certificate / OIDC / SA token)
       │
       ▼
Authorization   (are you allowed to create Pods? RBAC)
       │
       ▼
Admission Controllers ◄── plugins run here, in order
  ├── MutatingAdmissionWebhook  (can modify the object)
  ├── ValidatingAdmissionWebhook (can reject the object)
  ├── LimitRanger               (enforce default resource limits)
  ├── ResourceQuota             (enforce namespace quotas)
  └── PodSecurity               (enforce Pod Security Standards)
       │
       ▼
Object written to etcd
       │
       ▼
Controllers and scheduler act on the new object
```

### MutatingWebhookConfiguration

Mutating webhooks modify objects before they are stored. Common uses: inject sidecar containers (Istio, Vault), add default labels, enforce resource defaults.

```yaml
apiVersion: admissionregistration.k8s.io/v1
kind: MutatingWebhookConfiguration
metadata:
  name: sidecar-injector
webhooks:
- name: sidecar-injector.example.com
  admissionReviewVersions: ["v1"]
  clientConfig:
    service:
      name: sidecar-injector
      namespace: istio-system
      path: /inject
  rules:
  - apiGroups: [""]
    apiVersions: ["v1"]
    operations: ["CREATE"]
    resources: ["pods"]
  namespaceSelector:
    matchLabels:
      istio-injection: enabled    # only mutate Pods in labelled namespaces
  sideEffects: None
  failurePolicy: Fail             # Fail = reject the Pod if webhook errors
                                  # Ignore = allow the Pod if webhook errors
```

### ValidatingWebhookConfiguration

Validating webhooks reject objects that violate policy. They cannot modify the object — they only allow or deny.

```yaml
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingWebhookConfiguration
metadata:
  name: policy-validator
webhooks:
- name: no-latest-tag.example.com
  admissionReviewVersions: ["v1"]
  clientConfig:
    service:
      name: policy-server
      namespace: policy-system
      path: /validate-no-latest
  rules:
  - apiGroups: [""]
    apiVersions: ["v1"]
    operations: ["CREATE", "UPDATE"]
    resources: ["pods"]
  sideEffects: None
  failurePolicy: Fail
```

### OPA Gatekeeper

Open Policy Agent (OPA) Gatekeeper is a policy engine that runs as a ValidatingWebhook. Policies are written in Rego and deployed as `ConstraintTemplate` and `Constraint` CRDs.

```yaml
# ConstraintTemplate defines the policy structure
apiVersion: templates.gatekeeper.sh/v1
kind: ConstraintTemplate
metadata:
  name: k8srequiredlabels
spec:
  crd:
    spec:
      names:
        kind: K8sRequiredLabels
      validation:
        openAPIV3Schema:
          properties:
            labels:
              type: array
              items: {type: string}
  targets:
  - target: admission.k8s.gatekeeper.sh
    rego: |
      package k8srequiredlabels
      violation[{"msg": msg}] {
        provided := {label | input.review.object.metadata.labels[label]}
        required := {label | label := input.parameters.labels[_]}
        missing := required - provided
        count(missing) > 0
        msg := sprintf("Missing required labels: %v", [missing])
      }

---
# Constraint enforces the policy
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sRequiredLabels
metadata:
  name: pods-must-have-owner
spec:
  match:
    kinds:
    - apiGroups: [""]
      kinds: ["Pod"]
  parameters:
    labels: ["owner", "env"]    # all Pods must have these labels
```

### Kyverno

Kyverno is a Kubernetes-native policy engine that uses YAML instead of Rego. Easier to adopt for teams already comfortable with Kubernetes manifests.

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: disallow-latest-tag
spec:
  validationFailureAction: Enforce
  rules:
  - name: require-image-tag
    match:
      any:
      - resources:
          kinds: [Pod]
    validate:
      message: "Image tag ':latest' is not allowed. Pin a specific version."
      pattern:
        spec:
          containers:
          - image: "!*:latest"
```

---

## 4. Image Security

The container image is your first attack surface. A compromised image distributed to production is a catastrophic event.

### Never Use :latest

```
:latest is the default tag when no tag is specified.
It has no guarantees of stability — the same :latest tag can point to
different image digests on different days.

Problems with :latest in production:
  - Unpredictable: an image pull may get a different version than expected
  - Irreproducible: you cannot tell what code is running in a broken Pod
  - No security scanning baseline: you cannot track what changed

Always pin a specific, immutable tag:
  image: nginx:1.25.3                           ← semver tag (can be overwritten)
  image: nginx@sha256:a3f2c91d...               ← digest (immutable, best practice)

Digest-pinned images are truly immutable:
  Even if the registry is compromised and the tag is overwritten,
  the digest still points to the exact bytes you verified.
```

### Image Scanning

```bash
# Scan an image for vulnerabilities with Trivy (open-source, CNCF)
trivy image nginx:1.25.3

# Scan a local Dockerfile for misconfigurations
trivy config ./Dockerfile

# Scan a Kubernetes manifest for security issues
trivy k8s --report summary cluster

# Example output:
# CRITICAL  CVE-2023-XXXXX  openssl  3.0.1 → 3.0.8  Remote code execution
# HIGH      CVE-2023-XXXXX  libc     2.35   → 2.36   Buffer overflow
```

### Distroless Images

```
Standard image:        distroless image:
  FROM debian:12         FROM gcr.io/distroless/static-debian12
  Contains:              Contains ONLY:
  - shell (/bin/bash)    - your application binary
  - apt, curl, wget      - CA certificates
  - utilities            - timezone data
  - package managers     - /etc/passwd (minimal)

  If attacker gets code    If attacker gets code execution:
  execution → full shell   → no shell, no tools, almost nothing to do
  → can install tools
  → can exfiltrate data

Distroless tradeoff:
  - Harder to debug (no exec shell)
  - Smaller attack surface
  - Smaller image size → faster pulls
  - Fewer CVEs to patch
```

### No Root in Dockerfile

```dockerfile
# BAD: process runs as root by default
FROM python:3.11-slim
COPY . /app
WORKDIR /app
CMD ["python", "app.py"]

# GOOD: create a non-root user and switch to it
FROM python:3.11-slim
RUN groupadd -r appuser && useradd -r -g appuser appuser
COPY --chown=appuser:appuser . /app
WORKDIR /app
USER appuser                    # switch to non-root before CMD
CMD ["python", "app.py"]
```

---

## 5. Network Security

### NetworkPolicy Default-Deny

By default, all Pods in a Kubernetes cluster can communicate with all other Pods. A NetworkPolicy restricts traffic using label selectors. Without any NetworkPolicy, all traffic is allowed.

```yaml
# Step 1: Default deny all ingress and egress in the namespace
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: production
spec:
  podSelector: {}    # selects ALL Pods in the namespace
  policyTypes:
  - Ingress
  - Egress           # no ingress or egress rules = all traffic blocked
```

```yaml
# Step 2: Selectively allow what you need
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-to-backend
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: backend           # this policy applies to backend Pods
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: frontend      # only frontend Pods can send traffic to backend
    ports:
    - protocol: TCP
      port: 8080
```

```
Network policy is enforced by the CNI plugin (Calico, Cilium, Weave Net).
Flannel does NOT enforce NetworkPolicy. Always verify your CNI supports it.
```

### Service Mesh mTLS (Istio Overview)

```
Without service mesh:
  Pod A → Pod B over HTTP (plaintext)
  No authentication between services
  Compromised Pod C can impersonate Pod A

With Istio mTLS:
  Pod A (Envoy sidecar) ──mTLS──► Pod B (Envoy sidecar)
  Every service-to-service call is:
    - Encrypted (TLS)
    - Mutually authenticated (both sides present certificates)
    - Authorized (Istio AuthorizationPolicy controls which services can talk)

Istio auto-injects Envoy sidecars into Pods in labelled namespaces:
  kubectl label namespace production istio-injection=enabled

PeerAuthentication enforces mTLS mode:
  apiVersion: security.istio.io/v1beta1
  kind: PeerAuthentication
  metadata:
    name: default
    namespace: production
  spec:
    mtls:
      mode: STRICT    # all traffic must use mTLS, plaintext rejected
```

---

## 6. Secrets Management

### Kubernetes Secrets Are Base64, Not Encrypted

```
kubectl create secret generic db-pass --from-literal=password=SuperSecret123

kubectl get secret db-pass -o jsonpath='{.data.password}' | base64 -d
  → SuperSecret123

Base64 is encoding, NOT encryption.
Anyone with kubectl get secret access can decode it instantly.
Secrets in etcd are also NOT encrypted by default — they are stored as base64.

Risks:
  - Secrets leak into git if manifests include them
  - etcd backups contain secrets in plaintext
  - RBAC misconfiguration exposes secrets to wrong principals
```

### Encrypting etcd at Rest

```yaml
# /etc/kubernetes/encryption-config.yaml (on the API server node)
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
- resources:
  - secrets
  providers:
  - aescbc:
      keys:
      - name: key1
        secret: <base64-encoded-32-byte-key>
  - identity: {}    # fallback for reading unencrypted Secrets during rotation
```

```bash
# Enable encryption on the API server
kube-apiserver --encryption-provider-config=/etc/kubernetes/encryption-config.yaml

# After enabling, rotate all existing Secrets to encrypt them:
kubectl get secrets -A -o json | kubectl replace -f -
```

### External Secrets Operator

The best practice is to store secrets in a dedicated secrets store (HashiCorp Vault, AWS Secrets Manager, GCP Secret Manager) and sync them into Kubernetes Secrets using the External Secrets Operator.

```
Flow:
  AWS Secrets Manager: { "db_password": "SuperSecret123" }
         │
         ▼
  ExternalSecret CR (defines what to pull and where)
         │
         ▼
  External Secrets Operator (controller) syncs secret
         │
         ▼
  Kubernetes Secret (auto-created / auto-updated)
         │
         ▼
  Pod mounts the Kubernetes Secret

Benefits:
  - Secrets live in a dedicated, audited store with access controls
  - Kubernetes Secrets are auto-rotated when the upstream source changes
  - No secrets ever live in git
  - Centralized audit log of who read which secret and when
```

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: db-password
  namespace: production
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: ClusterSecretStore
  target:
    name: db-password           # name of the Kubernetes Secret to create
  data:
  - secretKey: password         # key in the Kubernetes Secret
    remoteRef:
      key: prod/db/password     # path in AWS Secrets Manager
      property: db_password     # JSON key within the secret
```

### Avoid Secrets in Environment Variables

```
Environment variables are accessible to any process that can read /proc/<pid>/environ.
They appear in kubectl describe pod output (if someone forgets to mark them as secrets).
They are often logged by accident.

Prefer mounting secrets as files:
  volumeMounts:
  - name: db-secret
    mountPath: /etc/secrets
    readOnly: true
  volumes:
  - name: db-secret
    secret:
      secretName: db-password

Then read in the application:
  password = open("/etc/secrets/password").read().strip()

  Benefits:
    - Secret value is not visible in kubectl describe or env output
    - File can be updated without restarting the Pod (if app polls it)
    - More aligned with 12-factor app principles
```

---

## 7. CIS Benchmark Highlights

The CIS (Center for Internet Security) Kubernetes Benchmark provides scored recommendations for hardening a Kubernetes cluster. The benchmark is organized by component.

### API Server

```
1.2.1  Ensure --anonymous-auth is set to false
       → Unauthenticated requests should be rejected
       kube-apiserver --anonymous-auth=false

1.2.2  Ensure --basic-auth-file is not set
       → Basic auth is deprecated; use certificates or OIDC

1.2.6  Ensure --authorization-mode includes Node and RBAC
       → kube-apiserver --authorization-mode=Node,RBAC

1.2.9  Ensure --tls-cert-file and --tls-private-key-file are set
       → API server must use TLS

1.2.22 Ensure --audit-log-path is set
       → Enable audit logging for compliance
       kube-apiserver --audit-log-path=/var/log/kubernetes/audit.log
                      --audit-log-maxage=30
                      --audit-log-maxbackup=10
                      --audit-log-maxsize=100
```

### etcd

```
2.1  Ensure --cert-file and --key-file are set for etcd
     → etcd must use TLS for peer and client communication

2.2  Ensure --client-cert-auth is set to true
     → Only authenticated clients can access etcd

2.6  Ensure that the etcd datadir ownership is set to etcd:etcd
     chmod 700 /var/lib/etcd
     chown etcd:etcd /var/lib/etcd
```

### Kubelet

```
4.2.1  Ensure --anonymous-auth is set to false
       → Kubelet API should require authentication
       kubelet --anonymous-auth=false

4.2.2  Ensure --authorization-mode is not set to AlwaysAllow
       → Use Webhook authorization
       kubelet --authorization-mode=Webhook

4.2.6  Ensure --protect-kernel-defaults is set to true
       → Kubelet should not change kernel parameters
       kubelet --protect-kernel-defaults=true

4.2.10 Ensure --tls-cert-file and --tls-private-key-file are set
       → Kubelet must use TLS
```

### Running the CIS Benchmark

```bash
# kube-bench is the standard tool for running CIS Kubernetes Benchmark checks
# Run as a Job on each node type

# Check control plane
kubectl apply -f https://raw.githubusercontent.com/aquasecurity/kube-bench/main/job-master.yaml
kubectl logs job/kube-bench-master

# Check worker nodes
kubectl apply -f https://raw.githubusercontent.com/aquasecurity/kube-bench/main/job-node.yaml
kubectl logs job/kube-bench-node

# Output format:
# [PASS] 1.2.1 Ensure that the --anonymous-auth argument is set to false
# [FAIL] 1.2.9 Ensure that the --tls-cert-file and --tls-private-key-file ...
# [WARN] 1.2.22 Ensure that the --audit-log-path argument is set
```

---

## 8. Hands-On Exercises

**Exercise 1:** Apply Pod Security Standards. Create two namespaces: `baseline-ns` with PSS level `baseline` (enforce mode) and `restricted-ns` with PSS level `restricted` (enforce mode). Try creating a Pod running as root (no `runAsNonRoot`) in `restricted-ns` — confirm it is rejected with a PSS violation message. Then create a compliant Pod with `runAsNonRoot: true`, `allowPrivilegeEscalation: false`, and `capabilities.drop: [ALL]` — confirm it is accepted. Try the same non-compliant Pod in `baseline-ns` and observe it is accepted there (baseline is less strict).

**Exercise 2:** Harden a Pod with securityContext. Start with a basic nginx Pod and add a complete `securityContext`: `runAsNonRoot: true`, `runAsUser: 101` (nginx's UID in the official image), `readOnlyRootFilesystem: true`, `allowPrivilegeEscalation: false`, `capabilities.drop: [ALL]`. Apply it. Note that nginx needs to write to `/var/cache/nginx` and `/var/run` — add `emptyDir` volumes for those paths. Exec into the Pod and confirm you cannot write to `/` (read-only filesystem) but can write to the emptyDir mounts. Run `id` inside the container and confirm it shows UID 101, not root.

**Exercise 3:** Implement NetworkPolicy default-deny. In a test namespace, create three Pods with labels `app: frontend`, `app: backend`, and `app: database`. Verify all three can curl each other. Apply a `default-deny-all` NetworkPolicy. Verify all curl requests now time out. Apply a targeted NetworkPolicy that only allows frontend → backend on port 8080 and backend → database on port 5432. Verify the allowed paths work and the blocked paths (frontend → database, database → frontend, etc.) are still blocked.

**Exercise 4:** Scan an image with Trivy. Install Trivy (`brew install aquasecurity/trivy/trivy` on macOS or equivalent). Run `trivy image nginx:1.24` and note the CVE count at each severity level. Then run `trivy image nginx:1.25` and compare — observe that upgrading to a newer patch reduces the vulnerability count. Run `trivy image nginx:latest` and observe that even `latest` may have known vulnerabilities. Run `trivy k8s --report summary cluster` (or against a specific namespace) if you have a running cluster to get a cluster-wide security report.

**Exercise 5:** Verify etcd Secret encryption. Check if encryption at rest is enabled on your cluster by running `kubectl get pod -n kube-system kube-apiserver-<node> -o yaml | grep encryption`. If on a managed cluster (EKS, GKE), check the console for encryption settings. Create a Secret: `kubectl create secret generic test-secret --from-literal=password=SuperSecret123`. Attempt to read the Secret directly from etcd using `etcdctl` (requires direct node access): `ETCDCTL_API=3 etcdctl get /registry/secrets/default/test-secret`. On an unencrypted cluster, you will see the base64-encoded value in plaintext. On an encrypted cluster, you will see cipher text (begins with `k8s:enc:aescbc:v1`).

---

## 9. Interview Q&A

**Q: What are Pod Security Standards and how do they replace PodSecurityPolicy?**
Answer: Pod Security Standards (PSS), introduced as stable in Kubernetes 1.25, define three security profiles — Privileged, Baseline, and Restricted — that control what a Pod is allowed to do. Enforcement is applied at the namespace level via labels rather than per-Policy admission control. PodSecurityPolicy (PSP) was a cluster-level admission controller that required a PSP to exist and a RoleBinding to grant it to each ServiceAccount — a complex setup where misconfiguration commonly resulted in either overly permissive or accidentally blocking policies. PSS is simpler: you label a namespace with an enforcement level, and Kubernetes's built-in PodSecurity admission controller applies the profile. The three modes (enforce, audit, warn) allow gradual adoption — you can start with warn to discover violations without breaking deployments, then move to enforce once workloads are compliant.

**Q: What does readOnlyRootFilesystem: true do and why is it a security best practice?**
Answer: Setting `readOnlyRootFilesystem: true` in a container's `securityContext` mounts the container's root filesystem as read-only. The container can read files from its image but cannot write to them. This is a defense-in-depth measure: if an attacker gains code execution inside the container, they cannot write persistent malware, modify configuration files, or alter the application binary. Any attack that relies on writing to the filesystem — dropping a reverse shell, installing tools, modifying configuration — is defeated. Legitimate writable paths (log directories, cache directories, temp files) should be mounted explicitly as `emptyDir` or PVC volumes. The constraint forces developers to be explicit about where the application writes data, which improves observability of filesystem usage.

**Q: What is the difference between OPA Gatekeeper and Kyverno?**
Answer: Both are Kubernetes policy engines that run as validating admission webhooks, but they differ in their policy language and philosophy. OPA Gatekeeper uses Rego, a purpose-built declarative policy language from Open Policy Agent. Rego is powerful and general-purpose — it can express complex multi-condition policies — but has a steep learning curve for teams unfamiliar with it. Policies are deployed as `ConstraintTemplate` (defines the Rego logic) and `Constraint` (defines the parameters and target resources) CRDs. Kyverno is Kubernetes-native: policies are written entirely in YAML using patterns, JMESPath expressions, and anchors. There is no separate language to learn. Kyverno also supports mutation (automatically patching objects) and generation (creating companion resources) in addition to validation. Gatekeeper is more mature and widely deployed; Kyverno is easier to adopt for Kubernetes-focused teams.

**Q: Why are Kubernetes Secrets not actually secure by default, and what should you do instead?**
Answer: Kubernetes Secrets are base64-encoded, which is trivially reversible — `echo <value> | base64 -d` decodes any Secret in seconds. They are stored in etcd without encryption unless the cluster administrator explicitly configures EncryptionConfiguration. Anyone with `kubectl get secret` access to the namespace can read the values. They are often accidentally committed to git when manifest files are checked in. The correct approach has multiple layers: first, enable etcd encryption at rest so Secret values in the etcd database are AES-encrypted. Second, use an external secrets store (HashiCorp Vault, AWS Secrets Manager, GCP Secret Manager) as the source of truth and sync values into Kubernetes Secrets using the External Secrets Operator, so secrets are never stored in git. Third, mount secrets as files rather than environment variables, since env vars are more easily logged and exposed. Fourth, apply strict RBAC so only the Pods and service accounts that need a Secret can read it.

**Q: What does the CIS Kubernetes Benchmark check, and how do you run it?**
Answer: The CIS Kubernetes Benchmark is a set of prescriptive, scored security recommendations for hardening Kubernetes components: the API server, etcd, the scheduler, the controller manager, and the kubelet. Key checks include ensuring the API server requires authentication (`--anonymous-auth=false`), uses RBAC authorization, has TLS configured, and has audit logging enabled. For etcd, it checks that TLS and client certificate authentication are required. For the kubelet, it checks that anonymous auth is disabled and authorization mode is set to Webhook rather than AlwaysAllow. The standard tool for running the benchmark is kube-bench by Aqua Security — you deploy it as a Kubernetes Job on each node type (control plane, worker), and it outputs PASS/FAIL/WARN for each CIS check with remediation guidance. Most managed Kubernetes services (EKS, GKE, AKS) pass many of these checks automatically, but worker node kubelet settings often require manual review.

---
