# Project 4: Ingress + TLS App

**Level:** Intermediate
**Time Estimate:** 90 – 120 minutes
**Phase Prerequisite:** Phase 7 – 8 (Networking, Configuration)

---

## Overview

This project demonstrates how to expose multiple services through a single nginx Ingress Controller with TLS termination handled by cert-manager and Let's Encrypt. You will implement path-based routing, automatic certificate provisioning, environment configuration via ConfigMap and Secret, and autoscaling with HPA.

```
                         Internet
                             │
                     ┌───────▼────────┐
                     │   DNS Record   │
                     │ myapp.example  │
                     │    .com → IP   │
                     └───────┬────────┘
                             │ HTTPS :443
                     ┌───────▼────────────────────────────┐
                     │     nginx Ingress Controller        │
                     │   (TLS Termination via cert-manager)│
                     │         LoadBalancer Service        │
                     └────────┬──────────────┬────────────┘
                              │              │
                  path: /     │              │  path: /api
          ┌───────────────────┘              └──────────────────────┐
          │                                                          │
  ┌───────▼────────┐                                       ┌────────▼───────┐
  │  frontend Svc  │                                       │  backend Svc   │
  │  (ClusterIP)   │                                       │  (ClusterIP)   │
  └───────┬────────┘                                       └────────┬───────┘
          │                                                          │
  ┌───────▼────────┐                                       ┌────────▼───────┐
  │ frontend Pods  │                                       │  backend Pods  │
  │  (nginx:alpine)│                                       │ (nginx:alpine) │
  └────────────────┘                                       └────────────────┘
          ▲                                                          ▲
          │                                                          │
  ┌───────┴────────┐                                       ┌────────┴───────┐
  │   ConfigMap    │  ◄─── both workloads consume ────►   │    Secret      │
  │  (app-config)  │                                       │  (app-secrets) │
  └────────────────┘                                       └────────────────┘
                                        ▲
                               ┌────────┴───────┐
                               │  cert-manager  │
                               │ Let's Encrypt  │
                               │  (ACME HTTP-01)│
                               └────────────────┘
```

---

## Prerequisites

- `kubectl` configured and pointing at a running cluster (minikube, kind, GKE, EKS, or AKS)
- Helm 3 installed (`helm version` should show v3.x)
- minikube with `minikube tunnel` capability, or a real cluster with a cloud LoadBalancer
- Phase 6 (Storage) project complete — familiarity with Kubernetes object model expected
- Basic DNS knowledge: understand what an A record is and how ACME HTTP-01 challenges work
- `curl` available locally for smoke-testing
- Optional: a real domain you control if you want production certificates

---

## What You'll Learn

1. **nginx Ingress Controller installation** via Helm and its role as the cluster's traffic gateway
2. **cert-manager installation** and its Custom Resource Definitions (CRDs)
3. **ClusterIssuer configuration** for Let's Encrypt staging and production endpoints
4. **Certificate resources** — how cert-manager provisions and renews TLS certificates automatically
5. **Ingress path-based routing** — directing traffic to different Services based on URL path
6. **TLS termination at the Ingress layer** — decrypting HTTPS before traffic reaches your pods
7. **Annotation-driven controller configuration** — SSL redirect, proxy body size, rate limiting
8. **ConfigMap injection** via `envFrom` to supply non-sensitive runtime configuration
9. **Secret injection** via `envFrom` to supply sensitive credentials securely
10. **Horizontal Pod Autoscaler (HPA)** — scaling the backend based on CPU utilisation

---

## Project Structure

```
ingress-tls-app/
├── namespace.yaml
├── configmap.yaml
├── secret.yaml
├── backend/
│   ├── deployment.yaml
│   ├── service.yaml
│   └── hpa.yaml
├── frontend/
│   ├── deployment.yaml
│   └── service.yaml
├── cert-manager/
│   ├── clusterissuer-staging.yaml
│   └── certificate.yaml
└── ingress.yaml
```

Create the working directory:

```bash
mkdir -p ingress-tls-app/{backend,frontend,cert-manager}
cd ingress-tls-app
```

---

## Step-by-Step Guide

### Step 1: Create the Namespace

All application resources live in the `ingress-demo` namespace, keeping them isolated from other workloads.

```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: ingress-demo
  labels:
    # Label used by NetworkPolicy selectors and tooling
    app.kubernetes.io/managed-by: kubectl
    environment: demo
```

```bash
kubectl apply -f namespace.yaml
kubectl get namespace ingress-demo
```

---

### Step 2: Install nginx Ingress Controller with Helm

The nginx Ingress Controller runs as a Deployment inside the cluster. It watches Ingress resources and programs nginx accordingly. We deploy two replicas for availability.

```bash
# Add the official ingress-nginx Helm chart repository
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx

# Refresh the local chart cache
helm repo update

# Install the controller into its own namespace
# controller.replicaCount=2 ensures availability during node disruptions
# controller.metrics.enabled=true exposes Prometheus metrics
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.replicaCount=2 \
  --set controller.metrics.enabled=true \
  --set controller.podAnnotations."prometheus\.io/scrape"=true \
  --set controller.podAnnotations."prometheus\.io/port"=10254

# Wait for the controller to become ready (up to 2 minutes)
kubectl rollout status deployment/ingress-nginx-controller -n ingress-nginx --timeout=120s

# Confirm pods are Running
kubectl get pods -n ingress-nginx

# Check that the LoadBalancer Service was created
# On minikube you need `minikube tunnel` running for EXTERNAL-IP to appear
kubectl get svc -n ingress-nginx
```

Expected output (pods):
```
NAME                                        READY   STATUS    RESTARTS   AGE
ingress-nginx-controller-5d4cf4f44-abc12    1/1     Running   0          60s
ingress-nginx-controller-5d4cf4f44-xyz89    1/1     Running   0          60s
```

---

### Step 3: Install cert-manager with Helm

cert-manager automates the lifecycle (issuance and renewal) of TLS certificates. It introduces three CRDs we use in later steps: `ClusterIssuer`, `Certificate`, and `CertificateRequest`.

```bash
# Add the Jetstack Helm chart repository (cert-manager vendor)
helm repo add jetstack https://charts.jetstack.io

# Refresh chart cache
helm repo update

# Install cert-manager v1.14.0
# installCRDs=true applies the CRD manifests as part of the Helm release
# This is simpler than applying them separately with kubectl
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --version v1.14.0 \
  --set installCRDs=true

# Wait for all three cert-manager components to be ready
kubectl rollout status deployment/cert-manager -n cert-manager --timeout=120s
kubectl rollout status deployment/cert-manager-webhook -n cert-manager --timeout=120s
kubectl rollout status deployment/cert-manager-cainjector -n cert-manager --timeout=120s

# Confirm all pods are Running
kubectl get pods -n cert-manager
```

Expected output:
```
NAME                                       READY   STATUS    RESTARTS   AGE
cert-manager-5c47f46f57-xkp2q             1/1     Running   0          90s
cert-manager-cainjector-6bd7c4f8b-lmn34   1/1     Running   0          90s
cert-manager-webhook-7f8c9d4f6-pqr56      1/1     Running   0          90s
```

---

### Step 4: Create ConfigMap and Secret

#### ConfigMap — non-sensitive runtime configuration

```yaml
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: ingress-demo
  labels:
    app.kubernetes.io/part-of: ingress-tls-app
data:
  # Base URL the frontend uses to reach the backend API
  # In a real deployment this would be the internal service DNS name
  API_BASE_URL: "https://myapp.example.com/api"

  # Log verbosity: debug | info | warn | error
  LOG_LEVEL: "info"

  # JSON-encoded feature flag map consumed by the application
  FEATURE_FLAGS: '{"darkMode":true,"betaSearch":false,"newCheckout":true}'

  # Maximum number of items returned by a single API page
  PAGE_SIZE: "50"

  # Timeout in milliseconds for upstream API calls
  REQUEST_TIMEOUT_MS: "5000"
```

#### Secret — sensitive credentials

> **Important:** In production, never commit base64-encoded secrets to source control. Use a secrets manager (Vault, AWS Secrets Manager, Sealed Secrets) instead.

Generate base64 values for this demo:

```bash
echo -n 'super-secret-api-key-12345' | base64
# Output: c3VwZXItc2VjcmV0LWFwaS1rZXktMTIzNDU=

echo -n 'db-password-very-secure-99' | base64
# Output: ZGItcGFzc3dvcmQtdmVyeS1zZWN1cmUtOTk=
```

```yaml
# secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: ingress-demo
  labels:
    app.kubernetes.io/part-of: ingress-tls-app
# Opaque is the default generic secret type for arbitrary key-value pairs
type: Opaque
data:
  # All values must be base64-encoded
  # Decode with: echo 'c3VwZX...' | base64 -d

  # Third-party API key for external service integration
  API_KEY: "c3VwZXItc2VjcmV0LWFwaS1rZXktMTIzNDU="

  # PostgreSQL database password
  DB_PASSWORD: "ZGItcGFzc3dvcmQtdmVyeS1zZWN1cmUtOTk="

  # JWT signing secret for session tokens
  JWT_SECRET: "bXktand0LXNpZ25pbmctc2VjcmV0LXN1cGVyLWxvbmc="
```

Apply both:

```bash
kubectl apply -f configmap.yaml
kubectl apply -f secret.yaml

# Verify (Secret data is redacted in describe output)
kubectl get configmap app-config -n ingress-demo -o yaml
kubectl describe secret app-secrets -n ingress-demo
```

---

### Step 5: Deploy the Backend API

The backend represents an API service. We use `nginx:alpine` as a stand-in — in a real project replace the image with your application container.

#### backend/deployment.yaml

```yaml
# backend/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: ingress-demo
  labels:
    app: backend
    tier: api
    app.kubernetes.io/part-of: ingress-tls-app
spec:
  replicas: 2
  # The selector must match the pod template labels
  selector:
    matchLabels:
      app: backend
  strategy:
    type: RollingUpdate
    rollingUpdate:
      # At most 1 pod unavailable during a rolling update
      maxUnavailable: 1
      # At most 1 extra pod created during a rolling update
      maxSurge: 1
  template:
    metadata:
      labels:
        app: backend
        tier: api
    spec:
      # Terminate gracefully — allow in-flight requests to complete
      terminationGracePeriodSeconds: 30
      containers:
        - name: backend
          image: nginx:alpine
          imagePullPolicy: IfNotPresent
          ports:
            - name: http
              containerPort: 80
              protocol: TCP

          # Inject all ConfigMap keys as environment variables
          envFrom:
            - configMapRef:
                name: app-config
            # Inject all Secret keys as environment variables
            - secretRef:
                name: app-secrets

          # Override specific env vars or add ones not in the ConfigMap
          env:
            - name: SERVICE_NAME
              value: "backend-api"
            - name: POD_NAME
              valueFrom:
                fieldRef:
                  fieldPath: metadata.name

          # Resource requests: what the scheduler uses for bin-packing
          # Resource limits: hard ceiling enforced by the kernel cgroups
          resources:
            requests:
              cpu: "100m"      # 0.1 vCPU
              memory: "128Mi"
            limits:
              cpu: "500m"      # 0.5 vCPU
              memory: "256Mi"

          # Readiness probe: pod receives traffic only when this passes
          # Failing readiness removes the pod from Service endpoints
          readinessProbe:
            httpGet:
              path: /health
              port: 80
            # Wait this many seconds before the first check
            initialDelaySeconds: 10
            # Check every 5 seconds
            periodSeconds: 5
            # Fail after 3 consecutive failures
            failureThreshold: 3
            # Succeed after 1 success (default)
            successThreshold: 1

          # Liveness probe: restart the container if this fails
          # More conservative thresholds than readiness to avoid flapping
          livenessProbe:
            httpGet:
              path: /health
              port: 80
            initialDelaySeconds: 15
            periodSeconds: 10
            failureThreshold: 5

          # Startup probe: gives slow-starting containers time to initialise
          # Kubernetes does not check liveness/readiness until this passes
          startupProbe:
            httpGet:
              path: /health
              port: 80
            failureThreshold: 30
            periodSeconds: 2
```

#### backend/service.yaml

```yaml
# backend/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: backend
  namespace: ingress-demo
  labels:
    app: backend
    tier: api
    app.kubernetes.io/part-of: ingress-tls-app
spec:
  # ClusterIP makes the service reachable only within the cluster
  # The Ingress controller forwards external traffic to this ClusterIP
  type: ClusterIP
  # Select pods with the matching label
  selector:
    app: backend
  ports:
    - name: http
      protocol: TCP
      # Port exposed by the Service (what the Ingress targets)
      port: 80
      # Port on the pod container
      targetPort: 80
```

```bash
kubectl apply -f backend/deployment.yaml
kubectl apply -f backend/service.yaml

# Confirm pods reach Running state
kubectl get pods -n ingress-demo -l app=backend
kubectl get svc backend -n ingress-demo
```

---

### Step 6: Deploy the Frontend

```yaml
# frontend/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: ingress-demo
  labels:
    app: frontend
    tier: web
    app.kubernetes.io/part-of: ingress-tls-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: frontend
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
  template:
    metadata:
      labels:
        app: frontend
        tier: web
    spec:
      terminationGracePeriodSeconds: 30
      containers:
        - name: frontend
          image: nginx:alpine
          imagePullPolicy: IfNotPresent
          ports:
            - name: http
              containerPort: 80
              protocol: TCP

          envFrom:
            - configMapRef:
                name: app-config
            - secretRef:
                name: app-secrets

          env:
            - name: SERVICE_NAME
              value: "frontend-web"
            - name: POD_NAME
              valueFrom:
                fieldRef:
                  fieldPath: metadata.name

          resources:
            requests:
              cpu: "50m"
              memory: "64Mi"
            limits:
              cpu: "200m"
              memory: "128Mi"

          readinessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 10
            periodSeconds: 5
            failureThreshold: 3

          livenessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 15
            periodSeconds: 10
            failureThreshold: 5

          startupProbe:
            httpGet:
              path: /
              port: 80
            failureThreshold: 30
            periodSeconds: 2
```

```yaml
# frontend/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: frontend
  namespace: ingress-demo
  labels:
    app: frontend
    tier: web
    app.kubernetes.io/part-of: ingress-tls-app
spec:
  type: ClusterIP
  selector:
    app: frontend
  ports:
    - name: http
      protocol: TCP
      port: 80
      targetPort: 80
```

```bash
kubectl apply -f frontend/deployment.yaml
kubectl apply -f frontend/service.yaml

kubectl get pods -n ingress-demo -l app=frontend
kubectl get svc frontend -n ingress-demo
```

---

### Step 7: Create the ClusterIssuer (Let's Encrypt Staging)

A `ClusterIssuer` is a cluster-scoped cert-manager resource that defines *how* certificates are obtained. We use the staging endpoint first to avoid hitting Let's Encrypt production rate limits during development.

> **Staging vs Production:** The Let's Encrypt staging CA is not trusted by browsers — you will see certificate warnings. Switch to production only after confirming the full flow works.

```yaml
# cert-manager/clusterissuer-staging.yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-staging
spec:
  acme:
    # Let's Encrypt staging ACME server
    # Certificates issued here are NOT trusted by browsers — for testing only
    server: https://acme-staging-v02.api.letsencrypt.org/directory

    # IMPORTANT: Replace with your real email address
    # Let's Encrypt uses this to notify you about expiring certificates
    # and to contact you about account issues
    email: your-email@example.com

    # cert-manager stores the ACME account private key in this Secret
    # The secret is created automatically in the cert-manager namespace
    privateKeySecretRef:
      name: letsencrypt-staging-account-key

    # ACME challenge solvers define how to prove domain ownership
    solvers:
      # HTTP-01 challenge: Let's Encrypt makes an HTTP request to
      # http://<domain>/.well-known/acme-challenge/<token>
      # The Ingress controller handles this automatically
      - http01:
          ingress:
            # Must match the ingress class of the nginx controller
            class: nginx
```

```bash
kubectl apply -f cert-manager/clusterissuer-staging.yaml

# Verify the ClusterIssuer is Ready
kubectl get clusterissuer letsencrypt-staging
kubectl describe clusterissuer letsencrypt-staging
```

The `READY` column should show `True` once cert-manager has registered with Let's Encrypt.

---

### Step 8: Create the Certificate Resource

A `Certificate` resource tells cert-manager *which* domains to certify and *which* issuer to use. cert-manager will create the TLS Secret automatically once the ACME challenge succeeds.

```yaml
# cert-manager/certificate.yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: myapp-tls
  namespace: ingress-demo
spec:
  # cert-manager creates a Kubernetes TLS Secret with this name
  # The Ingress resource references this same name in its tls block
  secretName: myapp-tls-secret

  # Certificate validity duration (default: 90 days for Let's Encrypt)
  duration: 2160h  # 90 days

  # Renew the certificate 30 days before expiry
  renewBefore: 720h  # 30 days

  # Subject fields (optional — Let's Encrypt ignores most of these)
  subject:
    organizations:
      - MyApp Inc

  # The primary domain name for the certificate (also the CN)
  commonName: myapp.example.com

  # All domain names covered by this certificate
  # Add additional subdomains here if needed
  dnsNames:
    - myapp.example.com

  # Reference to the ClusterIssuer created in Step 7
  issuerRef:
    # ClusterIssuer is cluster-scoped; use Issuer for namespace-scoped
    kind: ClusterIssuer
    name: letsencrypt-staging
    # cert-manager API group
    group: cert-manager.io
```

```bash
kubectl apply -f cert-manager/certificate.yaml

# Watch the certificate status (may take 1-3 minutes for ACME challenge)
kubectl get certificate myapp-tls -n ingress-demo -w

# Detailed status including ACME challenge events
kubectl describe certificate myapp-tls -n ingress-demo
```

> **Note:** In a local minikube environment without a real public domain, the ACME HTTP-01 challenge cannot complete because Let's Encrypt cannot reach your cluster. The certificate will remain `False/Pending`. This is expected for local development — the TLS flow still works using the self-signed certificate that cert-manager creates as a placeholder. For full certificate issuance, use a real domain and a publicly accessible cluster.

---

### Step 9: Create the Ingress Resource

The Ingress resource is the routing table. The nginx Ingress Controller reads it and programs nginx to route traffic accordingly. Annotations are the primary mechanism for configuring controller-specific behaviour.

```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: myapp-ingress
  namespace: ingress-demo
  labels:
    app.kubernetes.io/part-of: ingress-tls-app
  annotations:
    # ── Controller Selection ──────────────────────────────────────────────────
    # Tells Kubernetes which Ingress Controller should handle this resource.
    # Without this, multiple controllers might all try to process it.
    # The value "nginx" matches the --ingress-class flag set by the Helm chart.
    kubernetes.io/ingress.class: "nginx"

    # ── TLS / Certificate Management ─────────────────────────────────────────
    # Instructs cert-manager to watch this Ingress and automatically provision
    # a Certificate using the named ClusterIssuer. cert-manager creates the
    # TLS Secret referenced in the tls block below.
    cert-manager.io/cluster-issuer: "letsencrypt-staging"

    # ── SSL Enforcement ───────────────────────────────────────────────────────
    # When "true", nginx returns HTTP 308 (permanent redirect) for plain HTTP
    # requests, upgrading them to HTTPS. This ensures all traffic is encrypted.
    # Set to "false" only if you need to allow plain HTTP (not recommended).
    nginx.ingress.kubernetes.io/ssl-redirect: "true"

    # Forces HTTPS even if the X-Forwarded-Proto header is absent.
    # Useful when the cluster sits behind an L4 load balancer that does not
    # strip or set this header.
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"

    # ── Request / Response Tuning ─────────────────────────────────────────────
    # Maximum size of the client request body. nginx returns HTTP 413 if the
    # body exceeds this limit. Increase for file upload endpoints.
    # "0" disables the limit entirely (use with caution).
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"

    # Timeout (seconds) for reading a response from the proxied server.
    # Default is 60s. Increase for endpoints with expensive operations.
    nginx.ingress.kubernetes.io/proxy-read-timeout: "60"

    # Timeout (seconds) waiting to establish a connection to the upstream.
    nginx.ingress.kubernetes.io/proxy-connect-timeout: "10"

    # ── CORS (optional — uncomment if your frontend calls the API directly) ──
    # nginx.ingress.kubernetes.io/enable-cors: "true"
    # nginx.ingress.kubernetes.io/cors-allow-origin: "https://myapp.example.com"
    # nginx.ingress.kubernetes.io/cors-allow-methods: "GET, POST, PUT, DELETE, OPTIONS"
    # nginx.ingress.kubernetes.io/cors-allow-headers: "Authorization, Content-Type"

spec:
  # ── TLS Configuration ───────────────────────────────────────────────────────
  tls:
    - hosts:
        # List every hostname this certificate covers
        - myapp.example.com
      # Name of the Kubernetes Secret containing tls.crt and tls.key
      # cert-manager populates this Secret automatically
      secretName: myapp-tls-secret

  # ── Routing Rules ───────────────────────────────────────────────────────────
  rules:
    - host: myapp.example.com
      http:
        paths:
          # ── Frontend: all traffic to / ────────────────────────────────────
          - path: /
            # Prefix: matches / and any path that begins with /
            # e.g. /about, /login, /static/main.css all hit the frontend
            pathType: Prefix
            backend:
              service:
                name: frontend
                port:
                  number: 80

          # ── Backend API: traffic to /api ──────────────────────────────────
          - path: /api
            # Prefix: matches /api, /api/, /api/users, /api/v2/orders etc.
            pathType: Prefix
            backend:
              service:
                name: backend
                port:
                  number: 80
```

```bash
kubectl apply -f ingress.yaml

# Check the Ingress was created and has an address assigned
kubectl get ingress myapp-ingress -n ingress-demo

# Detailed view including events from the Ingress controller
kubectl describe ingress myapp-ingress -n ingress-demo
```

> **Path matching order:** nginx evaluates rules from most specific to least specific. Because `/api` is longer than `/`, API traffic is correctly routed to the backend even though `/` would also technically match. Always list more specific paths first in your manifest for clarity.

---

### Step 10: Create the HPA for the Backend

The HorizontalPodAutoscaler adjusts the number of backend pod replicas in response to CPU load. This requires the Kubernetes Metrics Server to be running in your cluster.

```yaml
# backend/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-hpa
  namespace: ingress-demo
  labels:
    app: backend
    app.kubernetes.io/part-of: ingress-tls-app
spec:
  # The Deployment this HPA controls
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend

  # Kubernetes will never scale below this many replicas
  minReplicas: 2

  # Kubernetes will never scale above this many replicas
  maxReplicas: 10

  metrics:
    # CPU utilisation metric — most common starting point
    - type: Resource
      resource:
        name: cpu
        target:
          # AverageUtilization is the mean CPU usage across all pods
          # expressed as a percentage of the pod's cpu request
          type: AverageUtilization
          # Scale up when average CPU > 70% of the requested amount
          # Scale down when average CPU drops well below 70% (with stabilisation)
          averageUtilization: 70

    # Memory utilisation metric — useful for memory-bound workloads
    - type: Resource
      resource:
        name: memory
        target:
          type: AverageUtilization
          averageUtilization: 80

  # Scaling behaviour tuning
  behavior:
    scaleUp:
      # Stabilise for 30 seconds before scaling up again
      stabilizationWindowSeconds: 30
      policies:
        # Allow adding at most 2 pods every 60 seconds
        - type: Pods
          value: 2
          periodSeconds: 60
    scaleDown:
      # Wait 5 minutes of sustained low load before scaling down
      # This prevents thrashing when load is bursty
      stabilizationWindowSeconds: 300
      policies:
        # Remove at most 1 pod every 60 seconds
        - type: Pods
          value: 1
          periodSeconds: 60
```

> **Metrics Server:** On minikube, enable it with `minikube addons enable metrics-server`. On real clusters, install it from `https://github.com/kubernetes-sigs/metrics-server`.

```bash
# On minikube only:
minikube addons enable metrics-server

kubectl apply -f backend/hpa.yaml

# View current HPA state
kubectl get hpa backend-hpa -n ingress-demo
kubectl describe hpa backend-hpa -n ingress-demo
```

---

### Step 11: Apply All Manifests in Order

If you are starting from a clean directory, apply resources in dependency order:

```bash
# 1. Namespace first — everything else depends on it
kubectl apply -f namespace.yaml

# 2. Configuration resources
kubectl apply -f configmap.yaml
kubectl apply -f secret.yaml

# 3. Backend workload
kubectl apply -f backend/deployment.yaml
kubectl apply -f backend/service.yaml

# 4. Frontend workload
kubectl apply -f frontend/deployment.yaml
kubectl apply -f frontend/service.yaml

# 5. cert-manager resources (ClusterIssuer before Certificate)
kubectl apply -f cert-manager/clusterissuer-staging.yaml
kubectl apply -f cert-manager/certificate.yaml

# 6. Ingress (after backend and frontend Services exist)
kubectl apply -f ingress.yaml

# 7. HPA (after backend Deployment exists)
kubectl apply -f backend/hpa.yaml

# Alternatively, apply the whole directory recursively
# kubectl apply -R -f .
# (Note: ordering is not guaranteed with recursive apply)
```

Verify all resources in the namespace:

```bash
kubectl get all -n ingress-demo
kubectl get ingress,certificate,secret -n ingress-demo
```

---

### Step 12: Local Testing with minikube

If you are using a real cloud cluster with a LoadBalancer, skip to the `curl` commands below — your EXTERNAL-IP will be populated automatically.

#### minikube setup

```bash
# Terminal 1: keep this running — it assigns a real IP to LoadBalancer Services
minikube tunnel

# Terminal 2: get the external IP assigned to the Ingress controller
kubectl get svc -n ingress-nginx

# Expected output (EXTERNAL-IP will be 127.0.0.1 on minikube with tunnel):
# NAME                                 TYPE           CLUSTER-IP      EXTERNAL-IP   PORT(S)
# ingress-nginx-controller             LoadBalancer   10.96.154.200   127.0.0.1     80:30080/TCP,443:30443/TCP
```

#### /etc/hosts entry for local DNS

```bash
# Add a local DNS entry so myapp.example.com resolves to 127.0.0.1
echo "127.0.0.1 myapp.example.com" | sudo tee -a /etc/hosts

# Verify the entry was added
grep myapp.example.com /etc/hosts
```

#### Smoke tests

```bash
# Test the frontend (path /)
# -k disables TLS verification (needed for staging/self-signed certs)
# -L follows redirects (HTTP → HTTPS redirect)
curl -k -L -v https://myapp.example.com

# Test the backend API (path /api)
curl -k -L -v https://myapp.example.com/api

# Test that HTTP is redirected to HTTPS (expect HTTP 308)
curl -v http://myapp.example.com

# Check response headers
curl -k -I https://myapp.example.com
```

#### Cleanup /etc/hosts (after the project)

```bash
# Remove the test entry when you are done
sudo sed -i '' '/myapp.example.com/d' /etc/hosts
```

---

### Step 13: Verify Certificate Issuance

cert-manager uses a pipeline of resources: `Certificate` → `CertificateRequest` → `Order` → `Challenge`.

```bash
# High-level status — READY should be True once the challenge completes
kubectl get certificate -n ingress-demo

# Detailed status, events, and conditions
kubectl describe certificate myapp-tls -n ingress-demo

# CertificateRequest created by cert-manager on behalf of the Certificate
kubectl get certificaterequest -n ingress-demo

# ACME Order resource (one per certificate issuance attempt)
kubectl get order -n ingress-demo

# HTTP-01 Challenge resource (one per domain)
kubectl get challenge -n ingress-demo

# Inspect the TLS secret once the certificate is issued
kubectl get secret myapp-tls-secret -n ingress-demo -o yaml

# Decode and inspect the certificate itself
kubectl get secret myapp-tls-secret -n ingress-demo \
  -o jsonpath='{.data.tls\.crt}' | base64 -d | openssl x509 -text -noout

# Check cert-manager logs for troubleshooting
kubectl logs -n cert-manager -l app=cert-manager --tail=50
```

Healthy certificate output from `kubectl get certificate`:
```
NAME        READY   SECRET             AGE
myapp-tls   True    myapp-tls-secret   5m
```

---

### Step 14: Test HPA by Generating Load

The load generator runs a tight loop of HTTP requests against the backend Service from inside the cluster.

```bash
# Run a busybox pod that hammers the backend Service
# --rm deletes the pod automatically when you exit
# -it attaches an interactive terminal
kubectl run load-generator \
  --image=busybox \
  -it --rm \
  --restart=Never \
  -n ingress-demo \
  -- /bin/sh -c "while true; do wget -q -O- http://backend/; done"
```

In a second terminal, watch the HPA respond:

```bash
# Watch HPA — TARGETS column shows current / threshold CPU utilisation
# REPLICAS column shows the current pod count
kubectl get hpa backend-hpa -n ingress-demo -w

# Also watch the pods scale up
kubectl get pods -n ingress-demo -l app=backend -w
```

Expected progression:
```
NAME          REFERENCE             TARGETS   MINPODS   MAXPODS   REPLICAS   AGE
backend-hpa   Deployment/backend   8%/70%    2         10        2          2m
backend-hpa   Deployment/backend   85%/70%   2         10        2          3m
backend-hpa   Deployment/backend   85%/70%   2         10        4          3m30s
backend-hpa   Deployment/backend   62%/70%   2         10        4          4m
```

Stop the load generator by pressing `Ctrl+C`. After the stabilisation window (5 minutes), the HPA will scale back down to 2 replicas.

---

## Verification

| Check | Command | Expected Result |
|-------|---------|-----------------|
| ingress-nginx pods running | `kubectl get pods -n ingress-nginx` | 2 pods in `Running` state |
| ingress-nginx LoadBalancer IP | `kubectl get svc ingress-nginx-controller -n ingress-nginx` | `EXTERNAL-IP` column populated |
| cert-manager pods running | `kubectl get pods -n cert-manager` | 3 pods in `Running` state (controller, webhook, cainjector) |
| backend pods running | `kubectl get pods -n ingress-demo -l app=backend` | 2 pods in `Running` state, `READY 1/1` |
| frontend pods running | `kubectl get pods -n ingress-demo -l app=frontend` | 2 pods in `Running` state, `READY 1/1` |
| ConfigMap created | `kubectl get configmap app-config -n ingress-demo` | ConfigMap listed |
| Secret created | `kubectl get secret app-secrets -n ingress-demo` | Secret listed, type `Opaque` |
| Certificate Ready | `kubectl get certificate myapp-tls -n ingress-demo` | `READY` column shows `True` |
| Ingress address assigned | `kubectl get ingress myapp-ingress -n ingress-demo` | `ADDRESS` column populated |
| ClusterIssuer Ready | `kubectl get clusterissuer letsencrypt-staging` | `READY` column shows `True` |
| HPA showing current replicas | `kubectl get hpa backend-hpa -n ingress-demo` | `MINPODS 2`, `MAXPODS 10`, `REPLICAS 2` |
| Frontend returns 200 | `curl -k -s -o /dev/null -w "%{http_code}" https://myapp.example.com/` | `200` |
| API path returns 200 | `curl -k -s -o /dev/null -w "%{http_code}" https://myapp.example.com/api` | `200` |
| HTTP redirects to HTTPS | `curl -s -o /dev/null -w "%{http_code}" http://myapp.example.com` | `308` |

---

## Challenges

### Challenge 1: Switch to Let's Encrypt Production

The staging CA issues untrusted certificates. Once you have confirmed the full flow works on staging, migrate to production to get a browser-trusted certificate.

1. Create `cert-manager/clusterissuer-production.yaml` — copy the staging ClusterIssuer and replace:
   - `name: letsencrypt-staging` → `name: letsencrypt-production`
   - `server: https://acme-staging-v02...` → `server: https://acme-v02.api.letsencrypt.org/directory`
   - `privateKeySecretRef.name: letsencrypt-staging-account-key` → `letsencrypt-production-account-key`

2. Update `cert-manager/certificate.yaml`:
   - Change `issuerRef.name` from `letsencrypt-staging` to `letsencrypt-production`
   - Change `secretName` to `myapp-tls-production-secret` (to avoid conflicts)

3. Update `ingress.yaml`:
   - Change annotation `cert-manager.io/cluster-issuer` to `letsencrypt-production`
   - Change `tls[0].secretName` to `myapp-tls-production-secret`

4. Apply changes and verify with:
   ```bash
   kubectl apply -f cert-manager/clusterissuer-production.yaml
   kubectl apply -f cert-manager/certificate.yaml
   kubectl apply -f ingress.yaml
   # Visit https://myapp.example.com in a browser — no certificate warning
   ```

> **Rate limit warning:** Let's Encrypt production has a limit of 5 duplicate certificates per week per domain. Do not repeatedly delete and re-create the Certificate resource.

---

### Challenge 2: Add Rate Limiting on the /api Path

nginx Ingress supports per-IP rate limiting via annotations. However, annotations apply to the entire Ingress object. To rate-limit only the `/api` path, create a second Ingress resource that covers only that path.

```yaml
# ingress-api-ratelimited.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: myapp-api-ingress
  namespace: ingress-demo
  annotations:
    kubernetes.io/ingress.class: "nginx"

    # Limit each client IP to 10 requests per second on /api
    # nginx returns HTTP 429 when the limit is exceeded
    nginx.ingress.kubernetes.io/limit-rps: "10"

    # Burst allows short spikes above the limit
    # Client can send up to 20 requests before being throttled
    nginx.ingress.kubernetes.io/limit-burst-multiplier: "2"

    # Rate limit by connection — complementary to RPS limiting
    nginx.ingress.kubernetes.io/limit-connections: "5"

    # Custom response when rate limit is hit (default: 503)
    nginx.ingress.kubernetes.io/custom-http-errors: "429"
spec:
  tls:
    - hosts:
        - myapp.example.com
      secretName: myapp-tls-secret
  rules:
    - host: myapp.example.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: backend
                port:
                  number: 80
```

Test the rate limit:

```bash
# Send 50 rapid requests and count 429 responses
for i in $(seq 1 50); do
  curl -k -s -o /dev/null -w "%{http_code}\n" https://myapp.example.com/api
done | sort | uniq -c
```

---

### Challenge 3: Add a Second Ingress for api.myapp.example.com

Create a dedicated subdomain for the API with its own TLS certificate and Ingress resource.

1. Add `api.myapp.example.com` to your `/etc/hosts`:
   ```bash
   echo "127.0.0.1 api.myapp.example.com" | sudo tee -a /etc/hosts
   ```

2. Create `cert-manager/certificate-api.yaml`:
   ```yaml
   apiVersion: cert-manager.io/v1
   kind: Certificate
   metadata:
     name: api-myapp-tls
     namespace: ingress-demo
   spec:
     secretName: api-myapp-tls-secret
     dnsNames:
       - api.myapp.example.com
     issuerRef:
       kind: ClusterIssuer
       name: letsencrypt-staging
       group: cert-manager.io
   ```

3. Create `ingress-api-subdomain.yaml`:
   ```yaml
   apiVersion: networking.k8s.io/v1
   kind: Ingress
   metadata:
     name: api-subdomain-ingress
     namespace: ingress-demo
     annotations:
       kubernetes.io/ingress.class: "nginx"
       cert-manager.io/cluster-issuer: "letsencrypt-staging"
       nginx.ingress.kubernetes.io/ssl-redirect: "true"
       # Strip the path prefix before forwarding to the backend
       # e.g. GET /v1/users → GET /v1/users (no stripping needed here)
       nginx.ingress.kubernetes.io/rewrite-target: /
   spec:
     tls:
       - hosts:
           - api.myapp.example.com
         secretName: api-myapp-tls-secret
     rules:
       - host: api.myapp.example.com
         http:
           paths:
             - path: /
               pathType: Prefix
               backend:
                 service:
                   name: backend
                   port:
                     number: 80
   ```

4. Apply and test:
   ```bash
   kubectl apply -f cert-manager/certificate-api.yaml
   kubectl apply -f ingress-api-subdomain.yaml
   curl -k https://api.myapp.example.com
   ```

---

## Key Takeaways

- **Ingress Controller as gateway:** The nginx Ingress Controller is a single entry point for all external HTTP/HTTPS traffic. It reads `Ingress` resources and dynamically reconfigures nginx — your pods never need to handle TLS or routing logic themselves.

- **cert-manager automates certificate lifecycle:** You declare *intent* (a `Certificate` resource) and cert-manager handles ACME challenges, Secret creation, and renewal 30 days before expiry. Certificates never expire silently.

- **Path-based routing decouples services:** A single domain and TLS certificate can front multiple independent backend services. Frontend and API teams deploy independently without coordinating on ports or domains.

- **TLS termination at the Ingress layer:** Decrypting HTTPS at the controller means your backend pods communicate in plain HTTP over the private cluster network. This simplifies backend code and reduces CPU overhead on pods.

- **Annotations are the configuration API:** nginx Ingress behaviour (redirects, timeouts, body size limits, rate limiting, CORS) is controlled entirely through Kubernetes annotations — no nginx.conf editing required. This keeps configuration declarative and version-controlled.

- **HPA enables elastic scaling:** By combining CPU/memory metrics with `minReplicas` and `maxReplicas` bounds, the backend scales automatically under load and scales back down during quiet periods, balancing cost and performance without manual intervention.

- **Staging before production:** Always validate the full ACME flow against Let's Encrypt staging before switching to production. Rate limits on the production endpoint are strict; hitting them blocks certificate issuance for your domain for a week.

- **Namespace isolation:** Placing all project resources in `ingress-demo` makes it trivial to inspect, debug, and tear down the entire project (`kubectl delete namespace ingress-demo`) without affecting other cluster workloads.

---

## Cleanup

When you are done with this project, remove all resources:

```bash
# Remove application namespace and all resources within it
kubectl delete namespace ingress-demo

# Remove cert-manager (optional — may be shared with other projects)
helm uninstall cert-manager -n cert-manager
kubectl delete namespace cert-manager

# Remove ingress-nginx (optional — may be shared with other projects)
helm uninstall ingress-nginx -n ingress-nginx
kubectl delete namespace ingress-nginx

# Remove ClusterIssuer (cluster-scoped — not deleted with namespace)
kubectl delete clusterissuer letsencrypt-staging

# Remove /etc/hosts entry
sudo sed -i '' '/myapp.example.com/d' /etc/hosts
```
