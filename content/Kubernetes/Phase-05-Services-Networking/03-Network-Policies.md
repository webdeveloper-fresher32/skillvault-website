# Network Policies — Complete Guide

## Table of Contents
1. [Why NetworkPolicy?](#1-why-networkpolicy)
2. [Default Behavior — Allow All](#2-default-behavior--allow-all)
3. [NetworkPolicy Fundamentals](#3-networkpolicy-fundamentals)
4. [Ingress Rules](#4-ingress-rules)
5. [Egress Rules](#5-egress-rules)
6. [Selectors — podSelector, namespaceSelector, ipBlock](#6-selectors--podselector-namespaceselector-ipblock)
7. [CNI Requirement](#7-cni-requirement)
8. [Common Patterns](#8-common-patterns)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. Why NetworkPolicy?

By default, every Pod in a Kubernetes cluster can communicate with every other Pod across all namespaces — there is no network isolation. This is intentional for simplicity but dangerous in multi-tenant, security-sensitive, or regulated environments.

Without NetworkPolicy:
```
┌────────────────────────────────────────────────────────┐
│  Kubernetes Cluster (default: all traffic allowed)    │
│                                                        │
│  Namespace: frontend    Namespace: backend             │
│  ┌──────────┐           ┌──────────┐                  │
│  │ web-pod  │──────────▶│ db-pod   │  ← should be     │
│  └──────────┘           └──────────┘    blocked!       │
│        │                                               │
│        └───────────────────────────────────────────┐   │
│                                        ┌──────────┐│   │
│  Namespace: monitoring                 │ prom-pod ││   │
│                                        └──────────┘│   │
│                                  ← also has access ┘   │
└────────────────────────────────────────────────────────┘
```

With NetworkPolicy, you can implement a **zero-trust network** where traffic is denied by default and only explicitly permitted flows are allowed.

---

## 2. Default Behavior — Allow All

Without any NetworkPolicy selecting a Pod, that Pod is **non-isolated** — it accepts all incoming and outgoing traffic.

The moment at least one NetworkPolicy selects a Pod, that Pod becomes **isolated** for the direction(s) covered by the policy. Any traffic not explicitly allowed by a matching policy is dropped.

```
No policy → Pod accepts all ingress + all egress
1 ingress policy → Pod accepts only explicitly allowed ingress; egress unchanged
1 egress policy  → Pod sends only explicitly allowed egress; ingress unchanged
Both ingress + egress policies → Pod is fully restricted in both directions
```

This additive model means multiple NetworkPolicies can apply to the same Pod — their rules are unioned (ORed), not ANDed.

---

## 3. NetworkPolicy Fundamentals

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: my-network-policy
  namespace: default         # NetworkPolicy is namespaced
spec:
  podSelector:               # selects Pods this policy applies TO
    matchLabels:
      app: my-app            # empty podSelector {} = selects ALL pods in namespace

  policyTypes:               # which directions this policy controls
    - Ingress
    - Egress

  ingress:                   # list of allowed inbound traffic rules
    - from: [...]            # sources allowed to reach selected Pods
      ports: [...]           # on these ports (if omitted: all ports)

  egress:                    # list of allowed outbound traffic rules
    - to: [...]              # destinations selected Pods can reach
      ports: [...]
```

### Key Concepts

- `podSelector` — selects which Pods in the same namespace this policy applies to
- `policyTypes` — declares `Ingress`, `Egress`, or both. Declaring a type with no rules means "block all" for that direction
- `ingress[].from` — a list of sources (ORed together). Each item can combine pod/namespace/IP selectors (ANDed)
- `egress[].to` — a list of destinations (ORed together)
- `ports` — optional; if omitted within a from/to rule, all ports are allowed

---

## 4. Ingress Rules

Ingress rules control what traffic is allowed INTO the selected Pods.

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-to-backend
  namespace: backend
spec:
  podSelector:
    matchLabels:
      app: api-server          # applies to api-server Pods in "backend" namespace

  policyTypes:
    - Ingress

  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: web         # allow from Pods labeled app=web
          namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: frontend  # in namespace "frontend"
      ports:
        - protocol: TCP
          port: 8080

    - from:
        - namespaceSelector:
            matchLabels:
              monitoring: "true"   # allow from any pod in monitoring namespaces
      ports:
        - protocol: TCP
          port: 9090               # metrics port only
```

```
Result:
frontend/web-pod → backend/api-server:8080  ✓ (allowed)
frontend/other  → backend/api-server:8080   ✗ (blocked — wrong pod label)
monitoring/*    → backend/api-server:9090   ✓ (allowed)
anything else   → backend/api-server        ✗ (blocked by default isolation)
```

### Ingress from All (specific port)

```yaml
ingress:
  - ports:
      - protocol: TCP
        port: 443
# "from:" is omitted → allow from ANYWHERE on port 443
# (but other ports are still blocked because Ingress policyType is declared)
```

---

## 5. Egress Rules

Egress rules control what traffic is allowed OUT of the selected Pods.

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: restrict-egress
  namespace: backend
spec:
  podSelector:
    matchLabels:
      app: api-server

  policyTypes:
    - Egress

  egress:
    - to:
        - podSelector:
            matchLabels:
              app: database     # allow to database pods
      ports:
        - protocol: TCP
          port: 5432

    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system   # allow DNS queries
      ports:
        - protocol: UDP
          port: 53
        - protocol: TCP
          port: 53
```

```
api-server → database:5432          ✓ (allowed)
api-server → kube-system DNS:53     ✓ (allowed — critical for name resolution)
api-server → internet               ✗ (blocked)
api-server → other internal pods    ✗ (blocked)
```

> Always explicitly allow DNS (UDP/TCP port 53 to CoreDNS) when you restrict egress, or your Pods will not be able to resolve any hostnames.

---

## 6. Selectors — podSelector, namespaceSelector, ipBlock

### podSelector

Selects Pods by their labels within the same namespace as the NetworkPolicy.

```yaml
from:
  - podSelector:
      matchLabels:
        role: monitoring
        tier: infra
# Allows from Pods that have BOTH labels (AND logic within matchLabels)
```

### namespaceSelector

Selects entire namespaces by their labels. All Pods in matching namespaces are selected.

```yaml
from:
  - namespaceSelector:
      matchLabels:
        environment: production
# Allows from ALL Pods in namespaces labeled environment=production
```

### Combining podSelector and namespaceSelector

When placed in the same `-` list item, they are ANDed (must match both). When placed as separate `-` list items, they are ORed (either can match).

```yaml
# AND: pod AND namespace both must match
from:
  - podSelector:
      matchLabels:
        app: frontend
    namespaceSelector:
      matchLabels:
        team: payments

# OR: pod match in same namespace, OR anything from other namespace
from:
  - podSelector:
      matchLabels:
        app: frontend
  - namespaceSelector:
      matchLabels:
        team: payments
```

```
AND semantics (single list item with both):
  Source must be a Pod with app=frontend IN a namespace with team=payments

OR semantics (two list items):
  Source is either: (a Pod with app=frontend in SAME namespace)
               OR:  (ANY Pod in a namespace with team=payments)
```

### ipBlock

Selects traffic based on IP CIDR ranges. Useful for allowing traffic from external systems.

```yaml
ingress:
  - from:
      - ipBlock:
          cidr: 203.0.113.0/24      # allow from this external CIDR
          except:
            - 203.0.113.10/32       # except this specific IP
    ports:
      - protocol: TCP
        port: 443

egress:
  - to:
      - ipBlock:
          cidr: 0.0.0.0/0           # allow all outbound
          except:
            - 10.0.0.0/8            # except RFC1918 private ranges
            - 172.16.0.0/12
            - 192.168.0.0/16
```

Note: ipBlock applies to IP addresses outside the cluster Pod CIDR. Traffic between Pods in the cluster is governed by podSelector and namespaceSelector.

---

## 7. CNI Requirement

NetworkPolicy is a Kubernetes API object, but **enforcement is delegated to the CNI (Container Network Interface) plugin**. The Kubernetes control plane itself does not enforce NetworkPolicies — it only stores them. If your CNI plugin does not support NetworkPolicy, creating policies has no effect.

### CNI Plugins That Support NetworkPolicy

| CNI Plugin | NetworkPolicy Support | Notes |
|------------|----------------------|-------|
| **Calico** | Full | Most widely used; supports GlobalNetworkPolicy extension |
| **Cilium** | Full + eBPF | Also supports L7 policies (HTTP path-based rules) |
| **Weave Net** | Full | Simpler setup |
| **Antrea** | Full | VMware-backed, good on vSphere |
| **flannel** | None | Does NOT support NetworkPolicy (need Calico or Cilium alongside) |
| **kubenet** | None | AWS EKS default without VPC CNI upgrade |

```bash
# Check which CNI plugin is running
kubectl get pods -n kube-system | grep -E 'calico|cilium|weave|flannel|antrea'

# Calico:
kubectl get pods -n calico-system

# Cilium:
kubectl get pods -n kube-system -l k8s-app=cilium
```

If you are running a CNI that does not support NetworkPolicy (e.g., flannel alone), you can add Calico in "policy-only" mode alongside flannel.

---

## 8. Common Patterns

### Pattern 1: Default Deny All Ingress

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: production
spec:
  podSelector: {}          # selects ALL pods in namespace
  policyTypes:
    - Ingress              # declares Ingress but provides no ingress rules
                           # = deny all ingress to all pods
```

### Pattern 2: Default Deny All Egress

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-egress
  namespace: production
spec:
  podSelector: {}
  policyTypes:
    - Egress               # deny all egress to all pods
```

### Pattern 3: Default Deny All (Both Directions)

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: production
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
```

### Pattern 4: Allow Only Within Namespace

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-same-namespace
  namespace: production
spec:
  podSelector: {}
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector: {}   # empty = any pod in same namespace
```

### Pattern 5: Tiered Application (Frontend → API → DB)

```yaml
# 1. Deny all by default
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny
  namespace: app
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]

# 2. Allow frontend ingress from internet (port 443)
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-ingress-frontend
  namespace: app
spec:
  podSelector:
    matchLabels:
      tier: frontend
  policyTypes: [Ingress, Egress]
  ingress:
    - ports: [{port: 443, protocol: TCP}]
  egress:
    - to:
        - podSelector:
            matchLabels:
              tier: api
      ports: [{port: 8080, protocol: TCP}]
    - to:                          # allow DNS
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
      ports:
        - {port: 53, protocol: UDP}
        - {port: 53, protocol: TCP}

# 3. Allow api to receive from frontend and send to db
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-api-tier
  namespace: app
spec:
  podSelector:
    matchLabels:
      tier: api
  policyTypes: [Ingress, Egress]
  ingress:
    - from:
        - podSelector:
            matchLabels:
              tier: frontend
      ports: [{port: 8080, protocol: TCP}]
  egress:
    - to:
        - podSelector:
            matchLabels:
              tier: db
      ports: [{port: 5432, protocol: TCP}]
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
      ports:
        - {port: 53, protocol: UDP}
        - {port: 53, protocol: TCP}

# 4. Allow db to receive from api only
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-db-tier
  namespace: app
spec:
  podSelector:
    matchLabels:
      tier: db
  policyTypes: [Ingress]
  ingress:
    - from:
        - podSelector:
            matchLabels:
              tier: api
      ports: [{port: 5432, protocol: TCP}]
```

```
Result:
Internet → frontend:443   ✓
frontend → api:8080        ✓
api      → db:5432         ✓
frontend → db:5432         ✗ (blocked)
api      → internet        ✗ (blocked)
db       → anything        ✗ (no egress policy needed; deny-all covers it)
```

---

## 9. Hands-On Exercises

**Exercise 1:** Create a namespace `netpol-lab`. Deploy two Pods: `client` (busybox) and `server` (nginx). Confirm that by default `client` can curl `server`. Apply a `default-deny-ingress` NetworkPolicy to the namespace. Confirm the curl now fails. Then add a NetworkPolicy that allows traffic from `client` to `server` on port 80 only. Confirm curl works again but only on port 80.

**Exercise 2:** Implement a three-tier NetworkPolicy for `frontend`, `api`, and `db` Pods in the same namespace. Apply default-deny-all first, then add targeted allow policies. Verify each allowed and denied traffic path by using `kubectl exec` to run curl commands between Pods. Document every test and its expected outcome before running it.

**Exercise 3:** Create two namespaces: `team-alpha` and `team-beta`. Deploy Pods in each namespace. Write a NetworkPolicy in `team-alpha` that only allows ingress from Pods in `team-alpha` (same namespace isolation). Verify that a Pod in `team-beta` cannot reach Pods in `team-alpha`. Then add a policy allowing specific Pods from `team-beta` (by label) to access a specific port in `team-alpha`.

**Exercise 4:** Write an egress NetworkPolicy that allows a Pod to reach only the internet (all external IPs) but blocks it from reaching any other Pod in the cluster (10.0.0.0/8 range). Use `ipBlock` with `except` clauses. Test by confirming `curl google.com` works but `curl <cluster-pod-ip>` fails. Remember to also allow DNS egress on port 53.

**Exercise 5:** Apply a `default-deny-all` policy to a namespace and then observe that even built-in services like readiness/liveness probes from the kubelet may be affected. Kubelet probes arrive from the node IP (host network), not as Pod-to-Pod traffic — observe that they continue working. Then test how a misconfigured policy that blocks DNS egress breaks all Service resolution in the namespace and what the symptoms look like.

---

## 10. Interview Q&A

**Q: What is a NetworkPolicy and what does it NOT do?**
Answer: A NetworkPolicy is a Kubernetes resource that specifies allowed ingress and egress traffic for a group of Pods based on label selectors, namespace selectors, and IP CIDRs. When no NetworkPolicy selects a Pod, the Pod is non-isolated and accepts all traffic. Once a NetworkPolicy selects a Pod, only traffic explicitly permitted by matching policies is allowed. What it does NOT do: it is not a firewall for node-level traffic (kubelet probes from the node IP are unaffected), it does not encrypt traffic (use mTLS/service mesh for encryption), it does not prevent a privileged Pod from bypassing network rules at the kernel level, and it has no effect if the CNI plugin does not implement NetworkPolicy enforcement.

**Q: What is the difference between having no NetworkPolicy vs a NetworkPolicy with an empty ingress list?**
Answer: These are very different. Having no NetworkPolicy on a Pod means the Pod is non-isolated and accepts all ingress traffic. A NetworkPolicy that declares `policyTypes: [Ingress]` but has an empty (or omitted) `ingress` list creates an isolation policy that blocks all ingress to selected Pods. The key is whether a NetworkPolicy with `Ingress` in `policyTypes` exists for the Pod. If yes but there are no `ingress` rules, all ingress is denied. If no NetworkPolicy selects the Pod, all ingress is allowed.

**Q: How does the AND vs OR logic work in NetworkPolicy `from` rules?**
Answer: Within a single item in the `from` list (same YAML list entry `-`), a `podSelector` and `namespaceSelector` are ANDed — the source must satisfy both conditions simultaneously. For example, a source must be a Pod labeled `app=frontend` AND be in a namespace labeled `team=payments`. Separate items in the `from` list are ORed — traffic is allowed if it matches any of the list items. This distinction matters a great deal: two selectors in one item versus two items with one selector each produce completely different security semantics.

**Q: Why must you allow DNS egress in a NetworkPolicy that restricts egress?**
Answer: CoreDNS runs at a fixed ClusterIP (usually the first IP in the service CIDR, e.g., `10.96.0.10`) and listens on UDP and TCP port 53 in the `kube-system` namespace. When you apply an egress NetworkPolicy, ALL outbound traffic from selected Pods is blocked unless explicitly allowed. Without a rule permitting UDP/TCP port 53 to CoreDNS (or to the `kube-system` namespace), Pods cannot resolve any DNS names — not cluster Service names, not external hostnames. This silently breaks all network calls that rely on DNS, which is nearly every application. The fix is to add an egress rule targeting `kube-system` namespace on ports 53/UDP and 53/TCP.

**Q: What is the relationship between CNI plugins and NetworkPolicy enforcement?**
Answer: The Kubernetes API accepts and stores NetworkPolicy objects regardless of the CNI plugin — kubectl apply always succeeds. However, the actual traffic enforcement is done by the CNI plugin running on each node, not by the Kubernetes control plane. CNI plugins like Calico, Cilium, Weave, and Antrea implement NetworkPolicy by programming iptables rules, eBPF programs, or similar mechanisms on each node to drop disallowed packets. If you use a CNI that does not support NetworkPolicy (such as flannel or kubenet), creating NetworkPolicy objects has zero effect — all traffic remains allowed. Always verify your CNI supports NetworkPolicy before relying on it for security.
