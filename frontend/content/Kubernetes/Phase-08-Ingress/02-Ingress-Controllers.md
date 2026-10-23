# Ingress Controllers — Complete Guide

## Table of Contents
1. [Why an Ingress Controller is Needed](#1-why-an-ingress-controller-is-needed)
2. [NGINX Ingress Controller](#2-nginx-ingress-controller)
3. [Traefik](#3-traefik)
4. [HAProxy Ingress](#4-haproxy-ingress)
5. [Cloud-Native Ingress Controllers](#5-cloud-native-ingress-controllers)
6. [Installing NGINX Ingress with Helm](#6-installing-nginx-ingress-with-helm)
7. [Key Annotations and Customisation](#7-key-annotations-and-customisation)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Why an Ingress Controller is Needed

The Kubernetes Ingress API is intentionally generic — it defines what routing should happen, not how. The **Ingress Controller** is the software that watches Ingress resources and implements the actual routing logic.

```
How Ingress Controllers Work
┌───────────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster                         │
│                                                               │
│  Developer creates/updates Ingress resources                  │
│          │                                                    │
│          ▼                                                    │
│  ┌───────────────────────────────────────────────┐           │
│  │         kube-apiserver (etcd)                  │           │
│  │   Ingress: host=app.example.com → svc:80       │           │
│  └──────────────────┬────────────────────────────┘           │
│                     │  watches for changes                   │
│                     ▼                                         │
│  ┌──────────────────────────────────────────────┐            │
│  │         Ingress Controller Pod               │            │
│  │   (NGINX / Traefik / HAProxy / ALB)          │            │
│  │   Translates Ingress rules →                 │            │
│  │   updates nginx.conf / Traefik config        │            │
│  └──────────────────┬───────────────────────────┘            │
│                     │  routes traffic                        │
│                     ▼                                         │
│  ┌──────────────────────────────────────────────┐            │
│  │   Backend Services & Pods                    │            │
│  └──────────────────────────────────────────────┘            │
└───────────────────────────────────────────────────────────────┘
```

The controller runs as a Deployment (or DaemonSet) inside the cluster, exposed via a Service of type LoadBalancer or NodePort. Multiple Ingress controllers can coexist in the same cluster — pods select which controller handles them using the `ingressClassName` field.

---

## 2. NGINX Ingress Controller

The **NGINX Ingress Controller** (maintained by the Kubernetes community) is the most widely deployed option. It uses NGINX as the underlying reverse proxy and dynamically reconfigures it when Ingress resources change.

```
NGINX Ingress Controller Architecture
┌──────────────────────────────────────────────────────────────┐
│                    Ingress Controller Pod                    │
│                                                              │
│  ┌────────────────┐     ┌─────────────────────────────────┐  │
│  │  nginx-ingress │     │          NGINX process          │  │
│  │  controller    │────▶│  /etc/nginx/nginx.conf          │  │
│  │  (Go binary)   │     │  upstream api-service { ... }   │  │
│  │  watches K8s   │     │  server { ... }                 │  │
│  │  API server    │     │  location /api { ... }          │  │
│  └────────────────┘     └─────────────────────────────────┘  │
│         │                              │                     │
│         │ updates config               │ handles traffic     │
│         ▼                              ▼                     │
│     nginx.conf                   → Backend Pods              │
└──────────────────────────────────────────────────────────────┘
```

**Key features:**
- Annotation-rich configuration — rate limiting, rewrites, CORS, auth
- Supports HTTPS upstream (end-to-end TLS)
- Built-in metrics via Prometheus stub_status
- WebSocket support
- Custom error pages
- ModSecurity WAF (optional)

```bash
# Install via official manifest (cloud provider)
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.9.4/deploy/static/provider/cloud/deploy.yaml

# Verify the controller is running
kubectl get pods -n ingress-nginx
kubectl get svc -n ingress-nginx

# Check NGINX controller version
kubectl exec -n ingress-nginx \
  $(kubectl get pods -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx -o name | head -1) \
  -- /nginx-ingress-controller --version
```

---

## 3. Traefik

**Traefik** is a modern, cloud-native reverse proxy and load balancer designed specifically for dynamic environments. It auto-discovers services and routes without requiring manual configuration reloads.

```
Traefik Architecture
┌──────────────────────────────────────────────────────────────┐
│                      Traefik Pod                             │
│                                                              │
│  ┌──────────────────┐   ┌──────────────────────────────┐    │
│  │  Kubernetes      │   │      Traefik Router           │    │
│  │  Provider        │──▶│  IngressRoute CRD             │    │
│  │  (watches K8s)   │   │  PathPrefix(`/api`)           │    │
│  │                  │   │  → api-service                │    │
│  │  Also supports:  │   └──────────────────────────────┘    │
│  │  - Docker        │                                        │
│  │  - Consul        │   ┌──────────────────────────────┐    │
│  │  - File          │   │   Middleware (composable)     │    │
│  └──────────────────┘   │   - Rate limiting             │    │
│                         │   - Auth                      │    │
│                         │   - Retry                     │    │
│                         │   - Circuit breaker           │    │
│                         └──────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

**Key features:**
- Built-in dashboard for visualising routes
- Automatic Let's Encrypt TLS certificate management
- Supports both standard Ingress resources and custom `IngressRoute` CRDs
- Middleware concept for composable request processing
- Native support for TCP and UDP routing

```bash
# Install Traefik with Helm
helm repo add traefik https://traefik.github.io/charts
helm repo update
helm install traefik traefik/traefik \
  --namespace traefik \
  --create-namespace \
  --set dashboard.enabled=true

# Access the Traefik dashboard (port-forward)
kubectl port-forward -n traefik svc/traefik-dashboard 9000:9000
```

```yaml
# Traefik IngressRoute CRD (more expressive than standard Ingress)
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: myapp-route
spec:
  entryPoints:
  - web
  - websecure
  routes:
  - match: Host(`myapp.example.com`) && PathPrefix(`/api`)
    kind: Rule
    services:
    - name: api-service
      port: 8080
    middlewares:
    - name: rate-limit
```

---

## 4. HAProxy Ingress

**HAProxy** is a high-performance TCP/HTTP load balancer. The HAProxy Ingress Controller wraps HAProxy in a Kubernetes-aware controller.

**Key features:**
- Extremely high throughput and low latency
- Advanced load-balancing algorithms (least connections, round robin, source IP hash)
- TCP mode support (not just HTTP/HTTPS)
- Session persistence (sticky sessions)
- Backend health checking with configurable intervals

```bash
# Install HAProxy Ingress with Helm
helm repo add haproxytech https://haproxytech.github.io/helm-charts
helm install haproxy-ingress haproxytech/kubernetes-ingress \
  --namespace haproxy-controller \
  --create-namespace
```

```yaml
# HAProxy Ingress with sticky sessions
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: myapp-ingress
  annotations:
    haproxy.org/load-balance: "leastconn"
    haproxy.org/cookie-persistence: "SERVERID"    # Sticky sessions
    haproxy.org/timeout-connect: "5s"
    haproxy.org/timeout-client: "30s"
    haproxy.org/timeout-server: "30s"
spec:
  ingressClassName: haproxy
  rules:
  - host: myapp.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: myapp-service
            port:
              number: 80
```

---

## 5. Cloud-Native Ingress Controllers

Major cloud providers offer native Ingress controllers that integrate deeply with their infrastructure:

```
Cloud-Native Ingress Controllers
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  AWS EKS                                                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ AWS Load Balancer Controller                             │  │
│  │ Ingress → AWS Application Load Balancer (ALB)            │  │
│  │ Uses AWS WAF, ACM certificates, Target Groups            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  GKE (Google Kubernetes Engine)                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ GKE Ingress Controller (built-in)                        │  │
│  │ Ingress → Google Cloud HTTP(S) Load Balancer             │  │
│  │ Uses Cloud Armor WAF, Google-managed TLS certificates    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Azure AKS                                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Application Gateway Ingress Controller (AGIC)            │  │
│  │ Ingress → Azure Application Gateway                      │  │
│  │ Uses Azure WAF, Key Vault TLS certificates               │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### AWS Load Balancer Controller

```bash
# Install AWS LBC with Helm
helm repo add eks https://aws.github.io/eks-charts
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=my-cluster \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller
```

```yaml
# AWS ALB Ingress
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: myapp-ingress
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:region:account:certificate/id
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTP": 80}, {"HTTPS": 443}]'
    alb.ingress.kubernetes.io/ssl-redirect: "443"
spec:
  ingressClassName: alb
  rules:
  - host: myapp.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: myapp-service
            port:
              number: 80
```

---

## 6. Installing NGINX Ingress with Helm

Helm provides a more configurable and maintainable installation than the raw manifest.

```bash
# Add the ingress-nginx Helm repository
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

# Install with default settings
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace

# Install with custom values
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.replicaCount=2 \
  --set controller.resources.requests.cpu=100m \
  --set controller.resources.requests.memory=90Mi \
  --set controller.metrics.enabled=true \
  --set controller.metrics.serviceMonitor.enabled=true \
  --set controller.autoscaling.enabled=true \
  --set controller.autoscaling.minReplicas=2 \
  --set controller.autoscaling.maxReplicas=10

# Verify the installation
kubectl get all -n ingress-nginx

# Get the external IP
kubectl get svc ingress-nginx-controller -n ingress-nginx
```

```yaml
# values.yaml for Helm — production-grade configuration
controller:
  replicaCount: 3
  resources:
    limits:
      cpu: 500m
      memory: 256Mi
    requests:
      cpu: 100m
      memory: 90Mi
  autoscaling:
    enabled: true
    minReplicas: 2
    maxReplicas: 20
    targetCPUUtilizationPercentage: 70
  metrics:
    enabled: true
    serviceMonitor:
      enabled: true          # For Prometheus scraping
  config:
    use-gzip: "true"
    gzip-level: "6"
    log-format-upstream: >-
      $remote_addr - $remote_user [$time_local] "$request"
      $status $body_bytes_sent "$http_referer" "$http_user_agent"
      $request_length $request_time [$proxy_upstream_name]
      [$proxy_alternative_upstream_name] $upstream_addr
      $upstream_response_length $upstream_response_time
      $upstream_status $req_id
```

---

## 7. Key Annotations and Customisation

### Rate Limiting

```yaml
metadata:
  annotations:
    # Limit to 100 requests per second per IP
    nginx.ingress.kubernetes.io/limit-rps: "100"
    # Burst multiplier (allows short spikes)
    nginx.ingress.kubernetes.io/limit-burst-multiplier: "5"
    # Limit connections per IP
    nginx.ingress.kubernetes.io/limit-connections: "10"
```

### URL Rewriting

```yaml
metadata:
  annotations:
    # Rewrite /api/v1/users to /users on the backend
    nginx.ingress.kubernetes.io/rewrite-target: /$2
    nginx.ingress.kubernetes.io/use-regex: "true"
spec:
  rules:
  - http:
      paths:
      - path: /api/v1(/|$)(.*)     # Capture group $2
        pathType: ImplementationSpecific
        backend:
          service:
            name: api-service
            port:
              number: 8080
```

### Authentication

```yaml
metadata:
  annotations:
    # Basic auth
    nginx.ingress.kubernetes.io/auth-type: basic
    nginx.ingress.kubernetes.io/auth-secret: basic-auth-secret
    nginx.ingress.kubernetes.io/auth-realm: "Authentication Required"
    # OAuth2 proxy
    nginx.ingress.kubernetes.io/auth-url: "https://oauth2-proxy.example.com/oauth2/auth"
    nginx.ingress.kubernetes.io/auth-signin: "https://oauth2-proxy.example.com/oauth2/start"
```

### Upstream Configuration

```yaml
metadata:
  annotations:
    # Timeouts
    nginx.ingress.kubernetes.io/proxy-connect-timeout: "10"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "60"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "60"
    # Body size limit (0 = unlimited)
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
    # Upstream keepalive
    nginx.ingress.kubernetes.io/upstream-keepalive-connections: "32"
    # WebSocket support
    nginx.ingress.kubernetes.io/proxy-http-version: "1.1"
```

---

## 8. Hands-On Exercises

**Exercise 1:** Install the NGINX Ingress Controller using Helm with 2 replicas and metrics enabled. Verify the installation by checking that the controller pods are running, the LoadBalancer service has an external IP, and the `IngressClass` resource named `nginx` exists. Run `kubectl get ingressclass` to confirm.

**Exercise 2:** Create three simple deployments and services: `frontend` (port 80), `api` (port 8080), and `admin` (port 3000). Create a single Ingress resource with path-based routing: `/` to frontend, `/api` to api service, `/admin` to admin service. Test each path using curl and verify the correct service responds.

**Exercise 3:** Configure rate limiting on the `/api` path of your Ingress with a limit of 5 requests per second. Use a shell loop (`for i in $(seq 1 20); do curl -s -o /dev/null -w "%{http_code}\n" http://<ip>/api; done`) to send 20 rapid requests and observe 429 responses after the rate limit is hit. Check the NGINX controller logs to confirm the rate limiting is active.

**Exercise 4:** Configure URL rewriting so that requests to `/api/v1/(.*)` on the Ingress are forwarded to `/(.*)` on the backend service (stripping the `/api/v1` prefix). Use `nginx.ingress.kubernetes.io/rewrite-target` with a capture group. Test with `curl http://<ip>/api/v1/health` and verify the backend receives a request to `/health`.

**Exercise 5:** Explore the difference between the NGINX community Ingress controller (`kubernetes/ingress-nginx`) and the NGINX Inc. controller (`nginxinc/kubernetes-ingress`). Install only the community controller. Read the values.yaml defaults for the Helm chart using `helm show values ingress-nginx/ingress-nginx` and identify three settings you would change for a production deployment. Document the reason for each change.

---

## 9. Interview Q&A

**Q: What is an Ingress Controller and why does Kubernetes not include one by default?**
Answer: An Ingress Controller is a Kubernetes component (typically a reverse proxy) that watches Ingress resources and implements the HTTP routing they describe. Kubernetes does not include a default Ingress Controller because there is no single "correct" implementation — different environments have different needs. NGINX, Traefik, and HAProxy suit self-managed clusters, while cloud providers have native controllers (AWS ALB, GKE Ingress, Azure AGIC) that integrate with their infrastructure. This separation of API from implementation allows users to choose the controller that best fits their use case.

**Q: How do multiple Ingress controllers coexist in the same cluster?**
Answer: Multiple Ingress controllers can coexist via `IngressClass` resources. Each controller creates or watches for an `IngressClass` with a specific name (e.g., `nginx`, `traefik`, `alb`). Ingress resources specify which controller should handle them via the `spec.ingressClassName` field. Requests that match an Ingress with `ingressClassName: nginx` are handled by the NGINX controller, while those with `ingressClassName: alb` are handled by the AWS Load Balancer Controller. You can also set a default `IngressClass` that applies to Ingress resources with no `ingressClassName` specified.

**Q: What are the trade-offs between NGINX Ingress, Traefik, and cloud-native controllers?**
Answer: NGINX Ingress is mature, widely supported, and has extensive annotation-based customisation, making it versatile for self-managed clusters. Traefik is more dynamic — it auto-discovers services and has a built-in dashboard, making it developer-friendly, but its CRD-based configuration is more complex for ops teams familiar with standard Ingress. Cloud-native controllers (AWS ALB, GKE Ingress, AGIC) offload load balancing to managed cloud infrastructure, providing better scalability, native WAF integration, and managed certificates, but they create vendor lock-in and require cloud-specific annotations that won't work on other platforms.

**Q: How do you perform zero-downtime updates to Ingress rules?**
Answer: Ingress rule updates are applied dynamically by the controller without restarting or dropping connections. When you `kubectl apply` a changed Ingress resource, the controller detects the change via its watch on the API server and hot-reloads its configuration (e.g., NGINX performs a graceful reload that drains existing connections before applying the new config). For the NGINX Ingress Controller, you can verify this in the controller logs — look for `backend successfully reloaded` messages. Zero-downtime is guaranteed as long as the backend services remain healthy and available.

**Q: What is the difference between the NGINX community Ingress controller and the NGINX Inc. controller?**
Answer: The community controller (`kubernetes/ingress-nginx`) is maintained by the Kubernetes project, uses standard open-source NGINX, and is the most widely used. The NGINX Inc. controller (`nginxinc/kubernetes-ingress`) is maintained by F5/NGINX Inc. and supports both open-source NGINX and NGINX Plus (commercial). The NGINX Plus variant offers additional enterprise features like real-time monitoring dashboard, advanced session persistence, and JWT authentication. The community controller uses annotations for configuration, while the NGINX Inc. controller uses CRDs (`VirtualServer`, `VirtualServerRoute`) for more type-safe, validated configuration.
