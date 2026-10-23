# ServiceAccounts — Complete Guide

## Table of Contents
1. [What is a ServiceAccount?](#1-what-is-a-serviceaccount)
2. [Default ServiceAccount](#2-default-serviceaccount)
3. [Creating and Using ServiceAccounts](#3-creating-and-using-serviceaccounts)
4. [Token Projection & Mounted Tokens](#4-token-projection--mounted-tokens)
5. [automountServiceAccountToken](#5-automountserviceaccounttoken)
6. [IRSA (AWS) and Workload Identity (GCP)](#6-irsa-aws-and-workload-identity-gcp)
7. [ImagePullSecrets on ServiceAccounts](#7-imagepullsecrets-on-serviceaccounts)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. What is a ServiceAccount?

A **ServiceAccount** is an identity for Pods — not for humans. When a human authenticates to the Kubernetes API, they use a user account (certificate, OIDC token, etc.). When a Pod running inside the cluster needs to call the Kubernetes API, it uses a ServiceAccount.

### The Two Identity Types in Kubernetes

```
Human users:
  kubectl → kubeconfig (certificate or OIDC token) → API server
  Kubernetes does NOT manage user accounts internally.
  Users come from external systems: certificates, LDAP, GitHub OIDC, etc.

Pods (workloads):
  Pod → ServiceAccount token (projected into /var/run/secrets/...) → API server
  Kubernetes DOES manage ServiceAccounts as API objects.
  They are namespaced resources.

A ServiceAccount answers the question:
  "Which Kubernetes identity does this Pod act as when calling the API?"
```

### Why Pods Call the Kubernetes API

| Use Case | Example |
|----------|---------|
| CI/CD agent | kubectl apply deployments |
| Autoscaler | Read pod metrics, scale Deployments |
| Operator | Watch CRDs, create/update resources |
| Secret injector | Read Secrets from the API and inject into Pods |
| Service mesh control plane | Read Endpoints, watch Services |

### ServiceAccount Scope

```
ServiceAccounts are NAMESPACED resources:
  namespace: default  → serviceaccount: default
  namespace: default  → serviceaccount: my-app
  namespace: prod     → serviceaccount: my-app   (different SA from above)

A Pod in namespace A cannot use a ServiceAccount from namespace B.
Permissions (via RBAC) are granted to a SA within a namespace.
```

---

## 2. Default ServiceAccount

Every namespace has a built-in ServiceAccount named `default`. When you create a Pod without specifying a ServiceAccount, Kubernetes automatically assigns it the `default` SA.

### What Gets Mounted Automatically

```
Pod spec (no serviceAccountName set):
  → Kubernetes mutating webhook assigns: serviceAccountName: default
  → A projected volume is automatically added to the Pod
  → Mounted at: /var/run/secrets/kubernetes.io/serviceaccount/

Contents of that directory inside the Pod:
  /var/run/secrets/kubernetes.io/serviceaccount/
  ├── token       ← JWT bearer token for authenticating to the API server
  ├── ca.crt      ← CA certificate to verify the API server's TLS cert
  └── namespace   ← the Pod's namespace as a plain text file
```

### Inspecting the Default Token

```bash
# Exec into any Pod
kubectl exec -it my-pod -- sh

# Read the token
cat /var/run/secrets/kubernetes.io/serviceaccount/token

# Read the namespace
cat /var/run/secrets/kubernetes.io/serviceaccount/namespace

# Call the Kubernetes API using the mounted token
TOKEN=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
curl -k -H "Authorization: Bearer $TOKEN" \
  https://kubernetes.default.svc.cluster.local/api/v1/namespaces/default/pods
```

### Default SA Has No Permissions by Default

```
The default ServiceAccount token is valid — the API server will authenticate it.
But without any RBAC RoleBinding, the default SA has no permissions.

Calling the API with the default SA token → 403 Forbidden (unless RBAC grants it).

Best practice: never grant permissions to the default SA.
               Create dedicated ServiceAccounts with minimal permissions.
```

---

## 3. Creating and Using ServiceAccounts

### Creating a ServiceAccount

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: app-reader
  namespace: default
```

```bash
kubectl apply -f serviceaccount.yaml
# or imperatively:
kubectl create serviceaccount app-reader -n default
```

### Assigning a ServiceAccount to a Pod

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: my-app
  namespace: default
spec:
  serviceAccountName: app-reader    # use this SA, not the default
  containers:
  - name: app
    image: myapp:1.0
```

### Granting Permissions via RBAC

A ServiceAccount is useless without RBAC. Bind it to a Role:

```yaml
# Role: allows reading Pods in the default namespace
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
  namespace: default
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list", "watch"]

---
# RoleBinding: grants the pod-reader Role to app-reader ServiceAccount
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: app-reader-pod-reader
  namespace: default
subjects:
- kind: ServiceAccount
  name: app-reader
  namespace: default
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

```
Flow:
  Pod (serviceAccountName: app-reader)
    → token mounted at /var/run/secrets/...
    → curl -H "Authorization: Bearer $TOKEN" https://k8s-api/api/v1/namespaces/default/pods
    → API server authenticates: "this is app-reader in namespace default"
    → API server authorizes: RoleBinding grants pod-reader Role to app-reader
    → Response: 200 OK, list of Pods
```

---

## 4. Token Projection & Mounted Tokens

Kubernetes moved from long-lived static tokens (stored as Secrets) to **projected service account tokens** generated by the TokenRequest API. These tokens are time-limited, audience-bound, and automatically rotated.

### Old Approach (pre-1.21): Secret-Based Token

```
A Secret of type kubernetes.io/service-account-token was created per SA.
The token never expired. If stolen, it was valid indefinitely.
The Secret token was mounted into Pods automatically.
```

### New Approach (1.21+): Projected Token via TokenRequest API

```
No long-lived Secret is created.
The kubelet calls the TokenRequest API to get a short-lived token.
The token is:
  - Audience-bound: only valid for the Kubernetes API (or a specified audience)
  - Time-bound:     expires after 1 hour by default (rotated before expiry)
  - Pod-bound:      bound to the specific Pod UID; invalid after Pod deletion

Pod spec (auto-generated if not specified):
  volumes:
  - name: kube-api-access
    projected:
      sources:
      - serviceAccountToken:
          expirationSeconds: 3607   # ~1 hour
          path: token
      - configMap:
          name: kube-root-ca.crt    # cluster CA cert
          items:
          - key: ca.crt
            path: ca.crt
      - downwardAPI:
          items:
          - path: namespace
            fieldRef:
              fieldPath: metadata.namespace
```

### Requesting a Custom Token (TokenRequest API)

```bash
# Request a token for a ServiceAccount with a specific audience and TTL
kubectl create token app-reader \
  --audience=https://my-api.example.com \
  --duration=30m

# The returned JWT can be decoded at jwt.io to inspect the claims:
# {
#   "iss": "https://kubernetes.default.svc.cluster.local",
#   "sub": "system:serviceaccount:default:app-reader",
#   "aud": ["https://my-api.example.com"],
#   "exp": 1719316800,
#   "kubernetes.io": {
#     "namespace": "default",
#     "serviceaccount": { "name": "app-reader", "uid": "..." }
#   }
# }
```

---

## 5. automountServiceAccountToken

By default, Kubernetes automatically mounts the ServiceAccount token into every Pod. Many Pods do not need to call the Kubernetes API at all. You can disable the automatic mount at the SA level or at the Pod level.

### Disable at the ServiceAccount Level

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: no-api-access
  namespace: default
automountServiceAccountToken: false    # no token mounted for Pods using this SA
```

### Disable at the Pod Level

```yaml
spec:
  serviceAccountName: app-reader
  automountServiceAccountToken: false  # overrides the SA's setting
  containers:
  - name: app
    image: nginx:1.25
```

### When to Set it to false

```
Set automountServiceAccountToken: false when:

  ✓ The Pod is a web server, worker, or database that never calls the Kubernetes API
  ✓ You follow the principle of least privilege — no token means no way to misuse one
  ✓ Your security policy requires it (PodSecurity, OPA Gatekeeper, Kyverno policies)

Leave it true (default) only when:
  ✓ The Pod runs an operator, controller, or CI agent that actively uses the API
  ✓ The workload is a service mesh data plane that needs cluster information

Risk of leaving it mounted unnecessarily:
  If the Pod is compromised, an attacker can use the token to call the Kubernetes API
  with whatever permissions the SA has (even if those are minimal, it's still exposure).
```

---

## 6. IRSA (AWS) and Workload Identity (GCP)

Pods often need to call cloud provider APIs (S3, GCS, DynamoDB, etc.), not just the Kubernetes API. Rather than storing cloud credentials as Kubernetes Secrets, modern clusters use **federated identity** — the Pod's Kubernetes ServiceAccount token is exchanged for a cloud IAM credential.

### IRSA — IAM Roles for Service Accounts (EKS)

```
Traditional approach (bad):
  Store AWS access keys in a Kubernetes Secret → mount into Pod as env vars
  Secret is long-lived, rotates manually, risk of leakage

IRSA approach (recommended):
  1. EKS cluster has an OIDC identity provider URL published
  2. Create an IAM Role with a trust policy that says:
     "Trust tokens issued by this EKS OIDC provider for this specific SA"
  3. Annotate the Kubernetes SA with the IAM Role ARN
  4. Pod's projected SA token is automatically exchanged for AWS credentials
     by the AWS SDK via the AWS_WEB_IDENTITY_TOKEN_FILE mechanism
```

```yaml
# Step 1: Annotate the ServiceAccount with the IAM Role ARN
apiVersion: v1
kind: ServiceAccount
metadata:
  name: s3-reader
  namespace: default
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789012:role/my-s3-reader-role
```

```json
// Step 2: IAM Role Trust Policy (created in AWS IAM console or Terraform)
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::123456789012:oidc-provider/oidc.eks.us-east-1.amazonaws.com/id/EXAMPLED539D4633E53DE1B71EXAMPLE"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "oidc.eks.us-east-1.amazonaws.com/id/EXAMPLED.../sub":
            "system:serviceaccount:default:s3-reader"
        }
      }
    }
  ]
}
```

```
IRSA token exchange flow:
  Pod (serviceAccountName: s3-reader)
    → kubelet projects OIDC token into Pod at $AWS_WEB_IDENTITY_TOKEN_FILE
    → AWS SDK reads token file + AWS_ROLE_ARN env var (injected by EKS webhook)
    → AWS SDK calls sts:AssumeRoleWithWebIdentity
    → STS validates token against EKS OIDC provider
    → STS returns temporary AWS credentials (15 min TTL, auto-rotated)
    → Pod calls S3 API with those temporary credentials
```

### Workload Identity (GKE)

GKE's equivalent of IRSA. A Kubernetes ServiceAccount is linked to a Google Service Account (GSA).

```yaml
# Annotate the KSA with the GSA email
apiVersion: v1
kind: ServiceAccount
metadata:
  name: gcs-reader
  namespace: default
  annotations:
    iam.gke.io/gcp-service-account: gcs-reader@my-project.iam.gserviceaccount.com
```

```bash
# Bind the KSA to the GSA using workload identity binding
gcloud iam service-accounts add-iam-policy-binding \
  gcs-reader@my-project.iam.gserviceaccount.com \
  --role=roles/iam.workloadIdentityUser \
  --member="serviceAccount:my-project.svc.id.goog[default/gcs-reader]"
```

```
GKE Workload Identity flow:
  Pod (serviceAccountName: gcs-reader)
    → Metadata server on the node detects the KSA annotation
    → Exchanges KSA token for GSA credentials via the GKE Metadata Server
    → Google Cloud libraries automatically use those credentials
    → Pod calls GCS API without any stored keys
```

---

## 7. ImagePullSecrets on ServiceAccounts

When pulling container images from a private registry, Kubernetes needs credentials. These can be attached to the ServiceAccount — any Pod using that SA automatically inherits the image pull credentials without needing to specify them per-Pod.

### Creating an Image Pull Secret

```bash
# Create the Secret from registry credentials
kubectl create secret docker-registry my-registry-creds \
  --docker-server=registry.example.com \
  --docker-username=myuser \
  --docker-password=mypassword \
  --docker-email=myuser@example.com
```

### Attaching to a ServiceAccount

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: app-sa
  namespace: default
imagePullSecrets:
- name: my-registry-creds    # any Pod using this SA auto-gets this pull secret
```

### Equivalent Per-Pod Approach (more verbose)

```yaml
spec:
  serviceAccountName: app-sa
  imagePullSecrets:            # specify per Pod if not on the SA
  - name: my-registry-creds
  containers:
  - name: app
    image: registry.example.com/myorg/myapp:1.0
```

```
Attaching to the SA is preferred:
  - Declared once, inherited by all Pods using that SA
  - No need to remember to add imagePullSecrets to every Pod manifest
  - RBAC still controls which namespaces can use the SA
  - Useful in multi-team clusters where each namespace has a SA for its registry
```

---

## 8. Hands-On Exercises

**Exercise 1:** Explore the default ServiceAccount. Create a busybox Pod without specifying a `serviceAccountName`. Exec into it and inspect `/var/run/secrets/kubernetes.io/serviceaccount/`. Read the `token` file and decode it at jwt.io to see the claims — note the `sub` field contains `system:serviceaccount:default:default`. Try calling the Kubernetes API using the token: `curl -k -H "Authorization: Bearer $(cat /var/run/secrets/kubernetes.io/serviceaccount/token)" https://kubernetes.default.svc.cluster.local/api/v1/namespaces/default/pods`. Observe the 403 response — the default SA has no RBAC permissions.

**Exercise 2:** Create a ServiceAccount with API access. Create a ServiceAccount named `pod-lister`. Create a Role that allows `get`, `list`, `watch` on Pods. Bind the Role to the SA via a RoleBinding. Create a Pod using `serviceAccountName: pod-lister`. Exec into the Pod and repeat the API call from Exercise 1. This time you should receive a 200 response with the list of Pods. Verify the SA token's `sub` field now shows `system:serviceaccount:default:pod-lister`.

**Exercise 3:** Disable automatic token mounting. Create a ServiceAccount named `no-token-sa` with `automountServiceAccountToken: false`. Create a Pod using this SA. Exec into the Pod and confirm that `/var/run/secrets/kubernetes.io/serviceaccount/` does not exist. Now create a second Pod using the same SA but with `automountServiceAccountToken: true` set at the Pod level — confirm the token IS mounted, demonstrating that Pod-level setting overrides SA-level setting.

**Exercise 4:** Attach imagePullSecrets to a ServiceAccount. Create a docker-registry Secret with fake credentials (the Secret creation will succeed even with invalid creds). Attach it to a ServiceAccount via `imagePullSecrets`. Create a Pod using that SA that references an image from a fake private registry (e.g., `private.registry.example.com/myapp:1.0`). Run `kubectl describe pod <name>` and confirm the `Image pull secret` section shows your Secret was used (even though the pull will fail with auth error, the secret was passed — demonstrating the mechanism works).

**Exercise 5:** Verify projected token expiry. Exec into a Pod with a mounted SA token and run `cat /var/run/secrets/kubernetes.io/serviceaccount/token | cut -d. -f2 | base64 -d 2>/dev/null | python3 -m json.tool`. Find the `exp` field (Unix timestamp). Calculate how far in the future it expires (`date -d @<exp>`). Wait a few minutes, re-read the token, and compare the `exp` — the kubelet will have automatically rotated it. Confirm the new token has a later `exp`, proving tokens are short-lived and auto-rotated.

---

## 9. Interview Q&A

**Q: What is a ServiceAccount in Kubernetes and how does it differ from a user account?**
Answer: A ServiceAccount is an identity for Pods — a namespaced Kubernetes API object that workloads use to authenticate to the Kubernetes API server. User accounts are for humans: they are not managed by Kubernetes itself but come from external systems like certificates, LDAP, or OIDC providers. Kubernetes does not have a User resource. ServiceAccounts, by contrast, are first-class Kubernetes objects that can be created, deleted, and bound to RBAC roles. When a Pod calls the Kubernetes API (e.g., an operator watching CRDs), it presents the ServiceAccount token mounted at `/var/run/secrets/kubernetes.io/serviceaccount/token`. The API server authenticates it as `system:serviceaccount:<namespace>:<name>` and then checks RBAC to determine what it is authorized to do.

**Q: What is the difference between the old static Secret-based SA tokens and the new projected tokens?**
Answer: The old approach created a Kubernetes Secret of type `kubernetes.io/service-account-token` for each ServiceAccount. That token never expired — it was valid indefinitely. If it was stolen, an attacker had permanent access until the Secret was manually deleted. Starting from Kubernetes 1.21, the default mechanism switched to projected tokens via the TokenRequest API. The kubelet requests a token from the API server that is audience-bound (only valid for the specified audience), time-bound (expires in ~1 hour by default), and Pod-bound (invalidated when the Pod is deleted). The kubelet automatically rotates the token before it expires. These tokens never appear as standalone Secrets and are far safer than the static approach.

**Q: What is IRSA, and why is it preferred over storing AWS credentials as Kubernetes Secrets?**
Answer: IRSA (IAM Roles for Service Accounts) is an AWS EKS feature that lets a Kubernetes ServiceAccount assume an AWS IAM Role without any stored credentials. The EKS cluster acts as an OIDC identity provider. An IAM Role's trust policy is configured to trust tokens issued by that OIDC provider for a specific ServiceAccount. The Pod's projected SA token is automatically exchanged for temporary AWS credentials via `sts:AssumeRoleWithWebIdentity`. The credentials are short-lived (15 minutes), automatically rotated, and scoped to the specific IAM Role. Compared to storing AWS access keys as Kubernetes Secrets, IRSA eliminates the risk of long-lived credentials leaking, removes the need for manual key rotation, and provides better auditability since CloudTrail shows which Kubernetes SA made which AWS API calls.

**Q: When should you set automountServiceAccountToken: false?**
Answer: You should set `automountServiceAccountToken: false` on any ServiceAccount or Pod that does not need to call the Kubernetes API. Most application Pods — web servers, workers, databases — have no legitimate reason to call the API. Leaving the token mounted exposes it unnecessarily: if the Pod is compromised, the attacker gains a valid token that can be used to probe the API server for information or escalate privileges if the SA has any permissions. Setting it to false is a defense-in-depth measure aligned with the principle of least privilege. It is especially important in multi-tenant clusters or when running third-party workloads where you do not fully trust the container's code. The setting can be placed on the ServiceAccount (applies to all Pods using it) and can be overridden per Pod.

**Q: How do imagePullSecrets on a ServiceAccount work, and what is the advantage over specifying them per Pod?**
Answer: When you attach an imagePullSecret to a ServiceAccount, any Pod that uses that ServiceAccount automatically inherits the image pull credentials without needing to declare them in the Pod spec. Kubernetes's admission process merges the SA's `imagePullSecrets` into the Pod's spec at creation time. The advantage is operational: you declare the pull credential once on the SA, and every Pod in that namespace using the SA benefits. This is particularly useful in namespaces where many Deployments pull from the same private registry — you do not have to remember to add `imagePullSecrets` to every manifest, and if the Secret is rotated, you update it in one place. It also reduces the blast radius if a developer forgets to add the pull secret to a new Deployment.

---
