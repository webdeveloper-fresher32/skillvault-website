# Ingress Fundamentals — Complete Guide

## Table of Contents
1. [What is Ingress](#1-what-is-ingress)
2. [Ingress vs Service Types](#2-ingress-vs-service-types)
3. [Ingress Spec and Structure](#3-ingress-spec-and-structure)
4. [Host-Based Routing](#4-host-based-routing)
5. [Path-Based Routing](#5-path-based-routing)
6. [Default Backend](#6-default-backend)
7. [Annotations](#7-annotations)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. What is Ingress

**Ingress** is a Kubernetes API object that manages external access to services in a cluster, typically HTTP and HTTPS traffic. It provides:

- **URL-based routing** — route requests to different services based on URL path
- **Host-based routing** — route requests to different services based on the hostname
- **TLS termination** — handle SSL/TLS at the Ingress layer, relieving backend services
- **Name-based virtual hosting** — serve multiple domains from a single IP address

```
Without Ingress (one LoadBalancer per service — expensive):
┌──────────┐     LB1:80  ┌─────────────┐
│ Internet │────────────▶│ frontend-svc│
└──────────┘     LB2:80  ├─────────────┤
                 ────────▶│   api-svc   │
                 LB3:80  ├─────────────┤
                 ────────▶│  admin-svc  │
                          └─────────────┘

With Ingress (one entry point — cost effective):
                          ┌──────────────────────────────────┐
┌──────────┐              │  Ingress                         │
│ Internet │──────────────▶  /         → frontend-svc:80     │
└──────────┘  Single LB   │  /api      → api-svc:8080        │
              Port 80/443  │  /admin    → admin-svc:3000      │
                          └──────────────────────────────────┘
```

**An Ingress resource alone does nothing.** It is merely a configuration object. An **Ingress Controller** must be installed in the cluster to read the Ingress rules and actually route traffic.

---

## 2. Ingress vs Service Types

```
Service Types Comparison
┌─────────────────────────────────────────────────────────────────────┐
│  Type           │ External Access │ Use Case                        │
│─────────────────┼─────────────────┼─────────────────────────────── │
│  ClusterIP      │ No              │ Internal cluster communication  │
│  NodePort       │ Yes (port)      │ Dev/testing on bare metal       │
│  LoadBalancer   │ Yes (LB IP)     │ Cloud: one LB per service       │
│  Ingress        │ Yes (HTTP/HTTPS)│ Production: multi-service HTTP  │
└─────────────────────────────────────────────────────────────────────┘
```

```
External Traffic → Ingress → /api  → api-service:8080
                          → /web  → web-service:80
                          → host  → other-service:3000
```

- **LoadBalancer** provisions a cloud load balancer for every Service — cost grows linearly with service count
- **Ingress** uses a single LoadBalancer (for the Ingress Controller) and routes based on HTTP rules — scales to many services without additional cloud resources
- Ingress only handles HTTP/HTTPS. For TCP/UDP services, you still need LoadBalancer or NodePort.

---

## 3. Ingress Spec and Structure

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: myapp-ingress
  namespace: default
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /    # Controller-specific
spec:
  ingressClassName: nginx                            # Which controller handles this
  rules:
  - host: myapp.example.com                         # Optional hostname
    http:
      paths:
      - path: /api
        pathType: Prefix                             # Prefix or Exact
        backend:
          service:
            name: api-service                        # Target Service
            port:
              number: 8080
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend-service
            port:
              number: 80
  tls:                                               # Optional TLS config
  - hosts:
    - myapp.example.com
    secretName: myapp-tls-secret
```

### Path Types

| pathType | Behaviour |
|----------|-----------|
| `Exact` | Matches the URL path exactly — `/api` matches only `/api`, not `/api/users` |
| `Prefix` | Matches based on a URL prefix split by `/` — `/api` matches `/api`, `/api/users`, `/api/v2` |
| `ImplementationSpecific` | Matching is up to the Ingress controller |

```bash
# Apply an Ingress resource
kubectl apply -f ingress.yaml

# List Ingress resources
kubectl get ingress

# Describe an Ingress (shows rules, backend services, address)
kubectl describe ingress myapp-ingress

# Get the external IP assigned to the Ingress
kubectl get ingress myapp-ingress -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
```

---

## 4. Host-Based Routing

Host-based routing (virtual hosting) allows different hostnames to be routed to different services. All traffic arrives at the same IP address, and the Ingress controller uses the HTTP `Host` header to select the correct backend.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: multi-host-ingress
spec:
  ingressClassName: nginx
  rules:
  - host: app.example.com         # Route based on this hostname
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: app-service
            port:
              number: 80
  - host: api.example.com         # Different hostname → different service
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: api-service
            port:
              number: 8080
  - host: admin.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: admin-service
            port:
              number: 3000
```

```
Host-Based Routing
                         ┌──────────────────────────────────┐
  app.example.com ──────▶│                                  │──▶ app-service:80
                         │     Ingress Controller           │
  api.example.com ──────▶│    (reads Host: header)          │──▶ api-service:8080
                         │                                  │
  admin.example.com ────▶│                                  │──▶ admin-service:3000
                         └──────────────────────────────────┘
          All at the same external IP address
```

```bash
# Test host-based routing locally (with curl)
curl -H "Host: app.example.com" http://<ingress-ip>/
curl -H "Host: api.example.com" http://<ingress-ip>/users
```

---

## 5. Path-Based Routing

Path-based routing sends requests to different backend services depending on the URL path. All requests use the same hostname.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: path-based-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /$2
spec:
  ingressClassName: nginx
  rules:
  - host: myapp.example.com
    http:
      paths:
      - path: /api(/|$)(.*)        # Match /api and /api/...
        pathType: ImplementationSpecific
        backend:
          service:
            name: api-service
            port:
              number: 8080
      - path: /static(/|$)(.*)
        pathType: ImplementationSpecific
        backend:
          service:
            name: static-service
            port:
              number: 80
      - path: /                    # Catch-all path
        pathType: Prefix
        backend:
          service:
            name: frontend-service
            port:
              number: 3000
```

```
Path-Based Routing at myapp.example.com
┌──────────────────────────────────────────────────────┐
│                   Ingress Controller                  │
│                                                      │
│  /api/*    ─────────────────────────▶ api-service    │
│  /static/* ─────────────────────────▶ static-service │
│  /*        ─────────────────────────▶ frontend-svc   │
└──────────────────────────────────────────────────────┘
      Path matching order: more specific paths first
```

**Important:** Rules are evaluated in order. Place more specific paths before less specific ones (e.g., `/api` before `/`). With most controllers, longer prefix matches take priority, but explicit ordering is safer.

---

## 6. Default Backend

The `defaultBackend` handles requests that do not match any Ingress rule. Without it, unmatched requests return a 404 or the controller's default error page.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: myapp-ingress
spec:
  ingressClassName: nginx
  defaultBackend:                  # Catch-all for unmatched requests
    service:
      name: default-backend
      port:
        number: 80
  rules:
  - host: myapp.example.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: api-service
            port:
              number: 8080
```

```bash
# Create a simple default backend service
kubectl create deployment default-backend \
  --image=nginxdemos/nginx-hello

kubectl expose deployment default-backend --port=80
```

---

## 7. Annotations

Annotations are used to pass configuration to the Ingress controller since the Ingress spec is intentionally generic. Each controller has its own annotation namespace.

```yaml
metadata:
  annotations:
    # NGINX Ingress Controller annotations
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
    nginx.ingress.kubernetes.io/proxy-connect-timeout: "30"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "120"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "120"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/use-regex: "true"
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-burst-multiplier: "5"
    # CORS
    nginx.ingress.kubernetes.io/enable-cors: "true"
    nginx.ingress.kubernetes.io/cors-allow-origin: "https://myapp.example.com"
```

```bash
# View annotations on an existing Ingress
kubectl get ingress myapp-ingress -o jsonpath='{.metadata.annotations}'

# Common troubleshooting: check Ingress controller logs
kubectl logs -n ingress-nginx \
  $(kubectl get pods -n ingress-nginx -o name | head -1) \
  --tail=50
```

---

## 8. Hands-On Exercises

**Exercise 1:** Install the NGINX Ingress Controller using the official manifest (`kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.9.4/deploy/static/provider/cloud/deploy.yaml`). Wait for the controller pod to be ready and note the external IP assigned to the `ingress-nginx-controller` LoadBalancer service. Then create two simple deployments (`hello-v1` and `hello-v2`) with ClusterIP services.

**Exercise 2:** Create an Ingress resource with path-based routing: requests to `/v1` go to `hello-v1` service and requests to `/v2` go to `hello-v2` service. Set `pathType: Prefix`. Test the routing using `curl http://<ingress-ip>/v1` and `curl http://<ingress-ip>/v2`. Observe the responses to confirm routing is working.

**Exercise 3:** Extend the Ingress from Exercise 2 to add host-based routing. Create a second Ingress rule for `api.example.com` that routes all traffic to a new `api-service`. Test by using `curl -H "Host: api.example.com" http://<ingress-ip>/`. Also create a `defaultBackend` that returns a custom 404 message for unmatched requests.

**Exercise 4:** Add an annotation to rate-limit requests to 10 requests per minute for one of your Ingress paths. Use `nginx.ingress.kubernetes.io/limit-rps: "10"`. Send more than 10 rapid requests using a loop and observe that the controller returns `503` responses once the limit is reached. Check the Ingress controller logs to see the rate limiting events.

**Exercise 5:** Investigate how `pathType: Exact` differs from `pathType: Prefix`. Create an Ingress with `Exact` matching for `/health` pointing to one service and `Prefix` matching for `/` pointing to another. Test that `curl /health` reaches the first service but `curl /health/` (with trailing slash) does NOT match the Exact rule and falls through to the Prefix rule. Document your findings.

---

## 9. Interview Q&A

**Q: What is a Kubernetes Ingress and how does it differ from a Service of type LoadBalancer?**
Answer: An Ingress is a Kubernetes API object that defines HTTP/HTTPS routing rules for external traffic into the cluster. A Service of type LoadBalancer provisions a separate cloud load balancer for each service, which becomes expensive as the number of services grows. An Ingress uses a single entry point (typically one LoadBalancer for the Ingress Controller) and routes to multiple backend services based on hostname and URL path rules, making it far more cost-effective for HTTP workloads. Ingress also supports TLS termination and name-based virtual hosting natively.

**Q: What is the difference between an Ingress resource and an Ingress Controller?**
Answer: An Ingress resource is a Kubernetes API object (like a Pod or Deployment) that declares the desired routing rules — it is just configuration. An Ingress Controller is the actual software component (a running pod, typically a reverse proxy like NGINX, Traefik, or HAProxy) that reads the Ingress resources and implements the routing. Without an Ingress Controller installed in the cluster, creating Ingress resources has no effect. Kubernetes does not include a default Ingress Controller — you must install one separately.

**Q: What is the difference between pathType Prefix and pathType Exact?**
Answer: `pathType: Exact` matches only if the request URL path is exactly equal to the specified path — `/api` matches `/api` but not `/api/` or `/api/users`. `pathType: Prefix` matches if the URL path starts with the specified prefix as a complete path segment — `/api` matches `/api`, `/api/`, and `/api/users`, but not `/apiv2`. This is because prefix matching splits on `/` boundaries, so `/api` as a prefix requires the next character to be `/` or end of path. Choosing the wrong pathType is a common source of Ingress routing bugs.

**Q: How does host-based routing work in Ingress?**
Answer: Host-based routing (virtual hosting) uses the HTTP `Host` request header to determine which Ingress rule to apply. The Ingress Controller reads the `Host` header from each incoming HTTP request and compares it against the `host` field in each Ingress rule. Requests matching `app.example.com` are routed to one backend, while requests matching `api.example.com` are routed to another — all arriving at the same external IP address. For this to work, DNS records for each hostname must resolve to the Ingress Controller's external IP.

**Q: What happens to requests that don't match any Ingress rule?**
Answer: If a `defaultBackend` is defined in the Ingress spec, unmatched requests are forwarded to that backend service. If no `defaultBackend` is defined, the Ingress controller handles them according to its default behaviour — NGINX Ingress returns a 404 with an NGINX default page. You should always define a custom `defaultBackend` in production to return a branded 404 page, and to avoid exposing the type of Ingress controller in use.
