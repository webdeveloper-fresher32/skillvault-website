# DNS and Service Discovery — Complete Guide

## Table of Contents
1. [How Service Discovery Works in Kubernetes](#1-how-service-discovery-works-in-kubernetes)
2. [CoreDNS — The Cluster DNS Server](#2-coredns--the-cluster-dns-server)
3. [DNS Resolution Format and FQDN](#3-dns-resolution-format-and-fqdn)
4. [Pod DNS and ndots](#4-pod-dns-and-ndots)
5. [DNS Policies](#5-dns-policies)
6. [Environment Variables for Service Discovery](#6-environment-variables-for-service-discovery)
7. [Debugging DNS Inside Pods](#7-debugging-dns-inside-pods)
8. [Custom DNS Configuration](#8-custom-dns-configuration)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. How Service Discovery Works in Kubernetes

Service discovery is the mechanism by which an application finds the network address of another service it depends on. Kubernetes supports two approaches:

1. **DNS-based discovery** (recommended) — every Service gets a DNS entry in the cluster DNS server (CoreDNS). Applications connect by name, and DNS resolves the name to the Service's ClusterIP.

2. **Environment variable-based discovery** (legacy) — when a Pod starts, Kubernetes injects environment variables describing every Service that existed at Pod creation time.

```
Application (in Pod)
      │  connects to "user-service:8080"
      ▼
  /etc/resolv.conf → nameserver 10.96.0.10 (CoreDNS ClusterIP)
      │
      ▼
  CoreDNS (10.96.0.10)
      │  looks up: user-service.default.svc.cluster.local
      ▼
  Returns: 10.96.45.123 (Service ClusterIP)
      │
      ▼
  kube-proxy routes to healthy Pod
```

---

## 2. CoreDNS — The Cluster DNS Server

CoreDNS is the official DNS server for Kubernetes clusters since version 1.13 (replacing kube-dns). It runs as a Deployment in the `kube-system` namespace and is exposed via a ClusterIP Service named `kube-dns` (the name is kept for backwards compatibility).

```bash
# Find CoreDNS pods
kubectl get pods -n kube-system -l k8s-app=kube-dns
# NAME                       READY   STATUS    RESTARTS   AGE
# coredns-5d78c9869d-4kz6f   1/1     Running   0          5d
# coredns-5d78c9869d-nt7f9   1/1     Running   0          5d

# Find the CoreDNS Service (ClusterIP assigned to DNS)
kubectl get svc kube-dns -n kube-system
# NAME       TYPE        CLUSTER-IP   EXTERNAL-IP   PORT(S)         AGE
# kube-dns   ClusterIP   10.96.0.10   <none>        53/UDP,53/TCP   5d

# View the CoreDNS configuration (Corefile)
kubectl get configmap coredns -n kube-system -o yaml
```

### CoreDNS Corefile

The Corefile controls CoreDNS behavior. The default Corefile looks like this:

```
.:53 {
    errors
    health {
        lameduck 5s
    }
    ready
    kubernetes cluster.local in-addr.arpa ip6.arpa {
        pods insecure
        fallthrough in-addr.arpa ip6.arpa
        ttl 30
    }
    prometheus :9153
    forward . /etc/resolv.conf {
        max_concurrent 1000
    }
    cache 30
    loop
    reload
    loadbalance
}
```

Key plugins:
- `kubernetes` — serves DNS for the cluster domain (`cluster.local`) by watching Services and Pods
- `forward` — forwards external queries to the node's upstream DNS (from `/etc/resolv.conf`)
- `cache` — caches responses to reduce latency
- `loadbalance` — randomizes the order of A records for basic load distribution

### Adding a Custom Stub Zone

To forward DNS for a specific domain to a private DNS server (e.g., an on-prem AD server):

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: coredns
  namespace: kube-system
data:
  Corefile: |
    .:53 {
        errors
        health
        kubernetes cluster.local in-addr.arpa ip6.arpa {
            pods insecure
            fallthrough in-addr.arpa ip6.arpa
        }
        forward . /etc/resolv.conf
        cache 30
        loop
        reload
        loadbalance
    }
    corp.example.com:53 {
        forward . 192.168.1.10   # on-prem DNS server
    }
```

---

## 3. DNS Resolution Format and FQDN

Every Service in Kubernetes gets a DNS entry in the following format:

```
<service-name>.<namespace>.svc.<cluster-domain>

Default cluster domain: cluster.local

Full example:
  my-app-svc.production.svc.cluster.local
  └─────────┘└──────────┘└──┘└───────────┘
   svc name   namespace   svc  cluster domain
```

### DNS Records Created for Services

| Service Type | DNS Record | Returns |
|-------------|-----------|---------|
| ClusterIP | A record | Single ClusterIP address |
| Headless (clusterIP: None) | A records | All matching Pod IPs |
| ExternalName | CNAME record | Configured external hostname |

### Short-name Resolution

Pods can use short names instead of the full FQDN because `/etc/resolv.conf` includes search domains:

```
# /etc/resolv.conf inside a Pod in namespace "default"
nameserver 10.96.0.10
search default.svc.cluster.local svc.cluster.local cluster.local
options ndots:5
```

Resolution order for a query `my-app-svc`:

```
1. my-app-svc.default.svc.cluster.local  ← appended from search[0]
2. my-app-svc.svc.cluster.local          ← appended from search[1]
3. my-app-svc.cluster.local              ← appended from search[2]
4. my-app-svc                            ← absolute name (external DNS)
```

### Cross-Namespace Resolution

To reach a Service in a different namespace, include the namespace in the name:

```bash
# From a Pod in namespace "frontend", connect to a Service in "backend" namespace
curl http://my-db-svc.backend:5432
# This resolves to: my-db-svc.backend.svc.cluster.local

# Full FQDN always works from any namespace
curl http://my-db-svc.backend.svc.cluster.local:5432
```

```
Namespace: frontend           Namespace: backend
┌─────────────────────┐       ┌─────────────────────┐
│  Pod (app: web)     │       │  Service: my-db-svc  │
│                     │──────▶│  ClusterIP: 10.96.x  │
│  connects to:       │       │                     │
│  my-db-svc.backend  │       │  Pods: db-pod-*      │
└─────────────────────┘       └─────────────────────┘
```

### Pod DNS Records

When `pods: insecure` or `pods: verified` is set in the CoreDNS Corefile, Pods also get DNS records:

```
Format: <pod-ip-with-dashes>.<namespace>.pod.cluster.local
Example: 10-0-1-5.default.pod.cluster.local → 10.0.1.5
```

---

## 4. Pod DNS and ndots

The `ndots` option in `/etc/resolv.conf` controls when a name is treated as a relative name (search domains applied) vs an absolute name (queried as-is).

```
options ndots:5
```

With `ndots:5` (Kubernetes default): if a name has fewer than 5 dots, search domains are appended first before trying the name as an absolute query.

```
Query: "db" (0 dots < 5)
  → Try: db.default.svc.cluster.local    (search domain appended)
  → Try: db.svc.cluster.local
  → Try: db.cluster.local
  → Try: db  (absolute)

Query: "my-db.backend.svc.cluster.local" (4 dots < 5)
  → Try: my-db.backend.svc.cluster.local.default.svc.cluster.local  ← wrong!
  → ... eventually resolves correctly but with extra round trips

Query: "my-db.backend.svc.cluster.local." (trailing dot = absolute, 0 ndots check)
  → Resolves immediately, no search domains appended
```

To avoid extra DNS lookups for FQDNs, append a trailing dot to make the name absolute, or configure `ndots: 1` in the Pod's `dnsConfig`.

---

## 5. DNS Policies

The `dnsPolicy` field in a Pod spec controls where the Pod's `/etc/resolv.conf` comes from.

```yaml
# Default policy: ClusterFirst
spec:
  dnsPolicy: ClusterFirst   # send cluster.local queries to CoreDNS, rest to node DNS
```

| Policy | Behavior |
|--------|---------|
| `ClusterFirst` | Default. Cluster DNS for cluster names; falls through to node DNS for external names |
| `ClusterFirstWithHostNet` | Use when `hostNetwork: true` — still routes cluster DNS through CoreDNS |
| `Default` | Pod inherits the node's `/etc/resolv.conf` — no cluster DNS |
| `None` | Pod ignores all defaults; `dnsConfig` is required to set resolv.conf manually |

### Custom DNS with dnsConfig

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: custom-dns-pod
spec:
  dnsPolicy: None
  dnsConfig:
    nameservers:
      - 8.8.8.8
      - 1.1.1.1
    searches:
      - my-company.internal
    options:
      - name: ndots
        value: "2"
      - name: timeout
        value: "5"
  containers:
    - name: app
      image: nginx
```

### Reducing DNS Latency

For performance-sensitive applications, reduce `ndots` to avoid unnecessary search domain lookups:

```yaml
spec:
  dnsConfig:
    options:
      - name: ndots
        value: "1"    # only apply search domains when name has 0 dots
  dnsPolicy: ClusterFirst
```

---

## 6. Environment Variables for Service Discovery

When a Pod is created, Kubernetes injects environment variables for every Service in the same namespace that existed at the time of Pod creation. The format is:

```
<SERVICE_NAME>_SERVICE_HOST=<ClusterIP>
<SERVICE_NAME>_SERVICE_PORT=<Port>
```

Example: if a Service named `my-database` exists with ClusterIP `10.96.5.20` and port `5432`:

```bash
# Inside the Pod
echo $MY_DATABASE_SERVICE_HOST   # 10.96.5.20
echo $MY_DATABASE_SERVICE_PORT   # 5432

# For named ports, additional variables are injected:
# MY_DATABASE_PORT_5432_TCP=tcp://10.96.5.20:5432
# MY_DATABASE_PORT_5432_TCP_PROTO=tcp
# MY_DATABASE_PORT_5432_TCP_PORT=5432
# MY_DATABASE_PORT_5432_TCP_ADDR=10.96.5.20
```

### Limitation: Ordering Dependency

Environment variables are only injected for Services that existed before the Pod was created. If you create the Pod first and the Service later, the variables are absent. DNS has no such ordering requirement — CoreDNS resolves Service names regardless of creation order.

```
Service created BEFORE Pod → env vars injected ✓
Service created AFTER Pod  → env vars missing  ✗
DNS always works regardless of creation order  ✓
```

This is why DNS-based discovery is strongly preferred over environment variable discovery.

---

## 7. Debugging DNS Inside Pods

### Using nslookup

```bash
# Spin up a debug Pod with DNS tools
kubectl run dns-debug --image=busybox:1.28 --rm -it --restart=Never -- sh

# Inside the Pod:
nslookup kubernetes.default
# Server:    10.96.0.10
# Address 1: 10.96.0.10 kube-dns.kube-system.svc.cluster.local
# Name:      kubernetes.default
# Address 1: 10.96.0.1 kubernetes.default.svc.cluster.local

# Check a specific Service
nslookup my-app-svc.production.svc.cluster.local
```

### Using dig

```bash
# More detailed DNS output
kubectl run dns-debug --image=tutum/dnsutils --rm -it --restart=Never -- bash

# Query with full output
dig my-app-svc.default.svc.cluster.local

# Query CoreDNS directly
dig @10.96.0.10 my-app-svc.default.svc.cluster.local

# Check PTR records (reverse DNS)
dig -x 10.96.45.123

# Trace the resolution path
dig +trace my-app-svc.default.svc.cluster.local
```

### Inspecting resolv.conf

```bash
kubectl exec -it my-pod -- cat /etc/resolv.conf
# nameserver 10.96.0.10
# search default.svc.cluster.local svc.cluster.local cluster.local
# options ndots:5
```

### Common DNS Failures and Fixes

```bash
# Issue 1: CoreDNS pod is down
kubectl get pods -n kube-system -l k8s-app=kube-dns
kubectl logs -n kube-system -l k8s-app=kube-dns

# Issue 2: Pod cannot reach CoreDNS (NetworkPolicy blocking)
kubectl get networkpolicy -n kube-system
# Ensure CoreDNS on port 53 UDP/TCP is not blocked

# Issue 3: Wrong service name (typo or wrong namespace)
kubectl get svc --all-namespaces | grep <partial-name>

# Issue 4: Service has no Endpoints (selector mismatch)
kubectl describe svc my-app-svc   # check Endpoints field
kubectl get endpoints my-app-svc

# Issue 5: Pod dnsPolicy is "Default" — not using CoreDNS
kubectl get pod my-pod -o jsonpath='{.spec.dnsPolicy}'

# Check CoreDNS logs for query errors
kubectl logs -n kube-system -l k8s-app=kube-dns --tail=50

# Enable CoreDNS debug logging temporarily
kubectl edit configmap coredns -n kube-system
# Add "log" plugin to Corefile, then rollout restart
kubectl rollout restart deployment coredns -n kube-system
```

---

## 8. Custom DNS Configuration

### NodeLocal DNSCache

NodeLocal DNSCache runs a DNS caching agent on every node (as a DaemonSet) to reduce latency by avoiding cross-node DNS queries. Queries are served from the local cache (169.254.20.10) before going to CoreDNS.

```
Pod → 169.254.20.10 (local DNS cache on same node)
    → CoreDNS only if cache miss
```

```bash
# Check if NodeLocal DNSCache is deployed
kubectl get daemonset node-local-dns -n kube-system
```

### Customizing CoreDNS for Specific Domains

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: coredns
  namespace: kube-system
data:
  Corefile: |
    .:53 {
        errors
        health
        kubernetes cluster.local in-addr.arpa ip6.arpa {
            pods insecure
            fallthrough in-addr.arpa ip6.arpa
        }
        forward . /etc/resolv.conf
        cache 30
        loop
        reload
        loadbalance
    }
    # Stub zone: forward all queries for legacy.internal to on-prem DNS
    legacy.internal:53 {
        errors
        cache 30
        forward . 10.0.0.53
    }
```

---

## 9. Hands-On Exercises

**Exercise 1:** Deploy two applications in different namespaces — run nginx in namespace `team-a` and a busybox Pod in namespace `team-b`. From the busybox Pod in `team-b`, resolve the nginx Service using its short name (`nginx-svc`), namespace-qualified name (`nginx-svc.team-a`), and full FQDN (`nginx-svc.team-a.svc.cluster.local`). Observe which forms work and which fail, and explain why based on the search domains in `/etc/resolv.conf`.

**Exercise 2:** Inspect the CoreDNS ConfigMap in the `kube-system` namespace. Identify each plugin in the Corefile and describe what it does. Then temporarily add the `log` plugin to the Corefile, restart CoreDNS, and watch the DNS query logs in real time using `kubectl logs -f`. Generate queries from a test Pod and correlate them with the log output.

**Exercise 3:** Create a Pod with `dnsPolicy: None` and a custom `dnsConfig` that uses `8.8.8.8` as the nameserver and `ndots: 1`. Verify that the Pod can resolve external names (e.g., `google.com`) but cannot resolve cluster Services by short name. Then switch the Pod to `dnsPolicy: ClusterFirst` and confirm cluster Service resolution works.

**Exercise 4:** Deploy a StatefulSet with 3 replicas and a headless Service. Use nslookup from a busybox Pod to resolve the headless Service DNS name and confirm you receive three separate A records — one per Pod. Then resolve each individual Pod's stable DNS name (`pod-0.headless-svc.namespace.svc.cluster.local`) and confirm it returns that specific Pod's IP.

**Exercise 5:** Simulate a DNS failure scenario. Scale CoreDNS to 0 replicas (`kubectl scale deployment coredns -n kube-system --replicas=0`). From a test Pod, try to resolve any Service name and observe the failure. Then restore CoreDNS to 2 replicas and verify resolution works again. Also observe that Pods that had already established TCP connections are unaffected (DNS failures only impact new connection attempts).

---

## 10. Interview Q&A

**Q: What is CoreDNS and why does Kubernetes use it?**
Answer: CoreDNS is a flexible, extensible DNS server written in Go that serves as the cluster DNS for Kubernetes. It replaced kube-dns starting in Kubernetes 1.13. Kubernetes uses CoreDNS to provide automatic DNS registration for every Service and Pod — when you create a Service, CoreDNS immediately makes it resolvable by name throughout the cluster. CoreDNS is configured via a Corefile that uses a plugin chain: the `kubernetes` plugin handles cluster-internal queries, and the `forward` plugin proxies external DNS queries to the node's upstream resolver. It runs as a Deployment in `kube-system` and is highly available with multiple replicas.

**Q: What is the DNS format for a Kubernetes Service, and how do Pods resolve short names?**
Answer: The fully qualified domain name (FQDN) for a Service is `<service-name>.<namespace>.svc.cluster.local`. Pods can use short names (just the Service name, or `service.namespace`) because their `/etc/resolv.conf` includes search domains: `<namespace>.svc.cluster.local svc.cluster.local cluster.local`. When a Pod queries `my-svc`, the resolver automatically appends each search domain in order until a match is found. The `ndots:5` option means names with fewer than 5 dots trigger search domain expansion first, so short-name resolution is fast within the same namespace but adds extra DNS round-trips for FQDNs.

**Q: What is the difference between dnsPolicy ClusterFirst and Default?**
Answer: `ClusterFirst` (the default) routes all DNS queries through CoreDNS. CoreDNS handles cluster-internal names directly and forwards external queries (e.g., `google.com`) to the node's upstream DNS. `Default` bypasses CoreDNS entirely — the Pod uses the node's `/etc/resolv.conf`, so it can resolve external names but cannot resolve cluster Service names at all. `ClusterFirstWithHostNet` is like `ClusterFirst` but for Pods that use `hostNetwork: true` — without this, hostNetwork Pods would inherit the node's DNS behavior and lose cluster DNS resolution.

**Q: Why is DNS-based service discovery preferred over environment variables?**
Answer: Environment variables for Service discovery have a critical ordering limitation: Kubernetes only injects env vars for Services that already existed when the Pod was created. If you create a Service after a Pod, the Pod has no env vars for it. DNS has no such dependency — CoreDNS serves queries based on the live Service state, so a Pod created before a Service can still resolve it by name the moment the Service is created. DNS also scales better; env vars inject O(services) variables into every Pod, which becomes noisy and can hit environment size limits in large clusters.

**Q: How would you debug a situation where a Pod cannot resolve a Service name?**
Answer: Start by exec-ing into the failing Pod and checking `/etc/resolv.conf` — verify the nameserver is CoreDNS's ClusterIP (typically `10.96.0.10`) and the search domains are correct. Run `nslookup kubernetes.default` to confirm basic cluster DNS works. If that fails, CoreDNS itself may be down — check CoreDNS Pod status and logs in `kube-system`. If basic resolution works but the specific Service fails, verify the Service exists in the correct namespace with `kubectl get svc`, confirm the FQDN is spelled correctly, and check `kubectl get endpoints` to ensure the Service has healthy Pods. A NetworkPolicy might be blocking UDP/TCP port 53 to CoreDNS — check `kubectl get networkpolicy --all-namespaces`.
