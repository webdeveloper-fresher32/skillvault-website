# TLS & SSL — Complete Guide

## Table of Contents
1. [TLS Termination in Kubernetes](#1-tls-termination-in-kubernetes)
2. [Creating a TLS Secret](#2-creating-a-tls-secret)
3. [Configuring Ingress for TLS](#3-configuring-ingress-for-tls)
4. [Cert-Manager — Automated Certificate Management](#4-cert-manager--automated-certificate-management)
5. [Let's Encrypt Integration](#5-lets-encrypt-integration)
6. [Wildcard Certificates](#6-wildcard-certificates)
7. [End-to-End TLS](#7-end-to-end-tls)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. TLS Termination in Kubernetes

**TLS termination** means the SSL/TLS encryption is decrypted at the Ingress layer. Backend services receive plain HTTP traffic, simplifying application code and certificate management.

```
TLS Termination Architecture
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Client                     Cluster                            │
│  ┌──────┐   HTTPS (TLS)  ┌──────────────┐   HTTP   ┌───────┐  │
│  │      │───────────────▶│   Ingress    │─────────▶│  Pod  │  │
│  │      │   encrypted    │  Controller  │ plaintext│       │  │
│  └──────┘                │  (decrypts)  │          └───────┘  │
│                          └──────────────┘                      │
│                                 │                              │
│                         reads TLS secret                       │
│                                 │                              │
│                          ┌──────▼──────┐                       │
│                          │ TLS Secret  │                       │
│                          │ tls.crt     │                       │
│                          │ tls.key     │                       │
│                          └─────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
```

**Benefits of TLS termination at Ingress:**
- Backend services do not need to manage certificates
- Centralised certificate rotation — update one Secret, all routes benefit
- Reduced CPU overhead on backend pods (TLS handshake handled by the controller)
- Easier compliance — encryption in transit is enforced uniformly

**Alternatives:**
- **Passthrough** — Ingress forwards encrypted traffic directly to backends (no decryption); backends handle TLS
- **End-to-end TLS** — Ingress decrypts, then re-encrypts to backends; both layers are encrypted

---

## 2. Creating a TLS Secret

A TLS Secret in Kubernetes has type `kubernetes.io/tls` and must contain exactly two keys: `tls.crt` (the certificate, PEM-encoded) and `tls.key` (the private key, PEM-encoded).

### Generate a Self-Signed Certificate (Testing)

```bash
# Generate private key and self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout tls.key \
  -out tls.crt \
  -subj "/CN=myapp.example.com/O=MyOrg"

# Verify the certificate
openssl x509 -in tls.crt -text -noout | grep -A 2 "Subject:"
```

### Create the TLS Secret via kubectl

```bash
# Create TLS secret from files
kubectl create secret tls myapp-tls \
  --cert=tls.crt \
  --key=tls.key

# Verify the secret was created
kubectl get secret myapp-tls
kubectl describe secret myapp-tls
# Note: kubectl describe shows key names and sizes only, not values
```

### Create the TLS Secret via YAML

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: myapp-tls
  namespace: default
type: kubernetes.io/tls
data:
  # Base64-encoded PEM certificate
  tls.crt: LS0tLS1CRUdJTi...    # base64 < tls.crt
  # Base64-encoded private key
  tls.key: LS0tLS1CRUdJTi...    # base64 < tls.key
```

```bash
# Base64 encode your certificate files
base64 -i tls.crt | tr -d '\n'
base64 -i tls.key | tr -d '\n'

# Apply the YAML
kubectl apply -f tls-secret.yaml

# Decode and inspect the certificate from the Secret
kubectl get secret myapp-tls -o jsonpath='{.data.tls\.crt}' | base64 --decode | openssl x509 -text -noout
```

---

## 3. Configuring Ingress for TLS

Once the TLS Secret exists, reference it in the Ingress `tls` section.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: myapp-ingress
  annotations:
    # Force HTTP → HTTPS redirect
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - myapp.example.com           # Must match the certificate CN or SAN
    secretName: myapp-tls         # The TLS Secret name
  - hosts:
    - api.example.com
    secretName: api-tls           # Each host can have its own certificate
  rules:
  - host: myapp.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend-service
            port:
              number: 80
  - host: api.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: api-service
            port:
              number: 8080
```

```bash
# Verify TLS is working
curl -k https://myapp.example.com/              # -k skips cert verification for self-signed
curl --cacert tls.crt https://myapp.example.com/ # Use the CA cert for verification

# Check the certificate returned by the Ingress
echo | openssl s_client -connect myapp.example.com:443 2>/dev/null | openssl x509 -text -noout
```

```
TLS Ingress — SNI routing
┌──────────────────────────────────────────────────────────────┐
│                    Ingress Controller                        │
│                                                              │
│  HTTPS request → SNI: myapp.example.com                     │
│  ────────────────────────────────────────────────────────▶   │
│  Reads TLS from Secret: myapp-tls                            │
│  Decrypts → routes to frontend-service:80                    │
│                                                              │
│  HTTPS request → SNI: api.example.com                        │
│  ────────────────────────────────────────────────────────▶   │
│  Reads TLS from Secret: api-tls                              │
│  Decrypts → routes to api-service:8080                       │
└──────────────────────────────────────────────────────────────┘
         SNI = Server Name Indication (TLS extension)
```

---

## 4. Cert-Manager — Automated Certificate Management

**cert-manager** is a Kubernetes-native certificate controller that automates the issuance and renewal of TLS certificates from various certificate authorities. It integrates with the Ingress controller to automatically provision certificates for Ingress resources.

```
cert-manager Architecture
┌──────────────────────────────────────────────────────────────────┐
│                       Kubernetes Cluster                         │
│                                                                  │
│  ┌────────────────┐    ┌──────────────────────────────────────┐  │
│  │ Ingress with   │    │         cert-manager                 │  │
│  │ annotation:    │───▶│  Certificate Controller              │  │
│  │ cert-manager   │    │  ChallengeController                 │  │
│  │ .io/cluster-   │    │  IssuerController                    │  │
│  │ issuer: letsenc│    └─────────────┬────────────────────────┘  │
│  └────────────────┘                 │                            │
│                                     │  ACME challenge            │
│  ┌────────────────┐                 ▼                            │
│  │  TLS Secret    │◀──    ┌────────────────────┐                │
│  │  (auto-created)│       │  Let's Encrypt /   │                │
│  │  tls.crt       │       │  Internal CA /     │                │
│  │  tls.key       │       │  Vault / ACM       │                │
│  └────────────────┘       └────────────────────┘                │
└──────────────────────────────────────────────────────────────────┘
```

### Installing cert-manager

```bash
# Install cert-manager with Helm
helm repo add jetstack https://charts.jetstack.io
helm repo update

helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --version v1.14.0 \
  --set installCRDs=true

# Verify cert-manager is running
kubectl get pods -n cert-manager
# NAME                                      READY   STATUS
# cert-manager-xxx                          1/1     Running
# cert-manager-cainjector-xxx               1/1     Running
# cert-manager-webhook-xxx                  1/1     Running
```

### cert-manager Custom Resources

cert-manager introduces several CRDs:

| Resource | Description |
|----------|-------------|
| `Issuer` | Issues certificates in a single namespace |
| `ClusterIssuer` | Issues certificates cluster-wide |
| `Certificate` | Requests a certificate from an Issuer |
| `CertificateRequest` | Low-level request used internally |
| `Order` | Represents an ACME order |
| `Challenge` | Represents an ACME challenge |

---

## 5. Let's Encrypt Integration

Let's Encrypt provides free, automated, and open TLS certificates. cert-manager uses the ACME protocol to request and renew them automatically.

### ACME Challenge Types

```
HTTP-01 Challenge (simpler, requires port 80 publicly accessible):
┌──────────────────────────────────────────────────────────────┐
│  cert-manager asks Let's Encrypt to verify domain ownership  │
│                                                              │
│  1. cert-manager creates a temporary HTTP route              │
│  2. Let's Encrypt fetches:                                   │
│     http://myapp.example.com/.well-known/acme-challenge/xxx  │
│  3. cert-manager serves the expected token                   │
│  4. Let's Encrypt verifies → issues certificate              │
└──────────────────────────────────────────────────────────────┘

DNS-01 Challenge (required for wildcard certs):
┌──────────────────────────────────────────────────────────────┐
│  1. cert-manager creates a DNS TXT record via DNS provider   │
│     _acme-challenge.myapp.example.com TXT "token-value"      │
│  2. Let's Encrypt queries DNS to find the record             │
│  3. DNS record matches → certificate issued                  │
│  4. cert-manager deletes the TXT record                      │
└──────────────────────────────────────────────────────────────┘
```

### ClusterIssuer for Let's Encrypt

```yaml
# Staging issuer — use this for testing (no rate limits)
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-staging
spec:
  acme:
    server: https://acme-staging-v02.api.letsencrypt.org/directory
    email: admin@example.com              # Your email for expiry notifications
    privateKeySecretRef:
      name: letsencrypt-staging-key       # Stores your ACME account private key
    solvers:
    - http01:
        ingress:
          ingressClassName: nginx         # Controller to use for HTTP-01 challenge
---
# Production issuer — use after testing works
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@example.com
    privateKeySecretRef:
      name: letsencrypt-prod-key
    solvers:
    - http01:
        ingress:
          ingressClassName: nginx
```

### Ingress with Automatic Certificate

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: myapp-ingress
  annotations:
    # Tell cert-manager which issuer to use
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - myapp.example.com
    secretName: myapp-tls-cert           # cert-manager auto-creates this Secret
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

```bash
# Monitor certificate issuance
kubectl get certificate
kubectl describe certificate myapp-tls-cert

# Check the certificate request
kubectl get certificaterequest
kubectl get order
kubectl get challenge

# Once issued, the secret is created automatically
kubectl get secret myapp-tls-cert
```

### Manual Certificate Resource

You can also create a `Certificate` resource directly without the Ingress annotation:

```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: myapp-cert
  namespace: default
spec:
  secretName: myapp-tls-cert            # Where to store the resulting Secret
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  commonName: myapp.example.com
  dnsNames:
  - myapp.example.com
  - www.myapp.example.com
  duration: 2160h                        # 90 days (Let's Encrypt default)
  renewBefore: 360h                      # Renew 15 days before expiry
```

---

## 6. Wildcard Certificates

A **wildcard certificate** (e.g., `*.example.com`) covers all subdomains of a domain. Wildcard certificates require the **DNS-01** challenge because Let's Encrypt cannot verify subdomain ownership via HTTP.

```yaml
# DNS-01 ClusterIssuer using Route53 (AWS)
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-dns
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@example.com
    privateKeySecretRef:
      name: letsencrypt-dns-key
    solvers:
    - dns01:
        route53:
          region: ap-southeast-2
          hostedZoneID: Z1234567890ABC    # Your Route53 hosted zone ID
          accessKeyIDSecretRef:
            name: route53-credentials
            key: access-key-id
          secretAccessKeySecretRef:
            name: route53-credentials
            key: secret-access-key
```

```yaml
# Wildcard Certificate
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: wildcard-cert
  namespace: default
spec:
  secretName: wildcard-tls
  issuerRef:
    name: letsencrypt-dns
    kind: ClusterIssuer
  commonName: "*.example.com"
  dnsNames:
  - "*.example.com"
  - "example.com"                        # Also cover the apex domain
```

```yaml
# Use the wildcard cert in an Ingress
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: multi-app-ingress
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - app.example.com
    - api.example.com
    - admin.example.com
    secretName: wildcard-tls             # One cert covers all subdomains
  rules:
  - host: app.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: app-service
            port:
              number: 80
  - host: api.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: api-service
            port:
              number: 8080
```

---

## 7. End-to-End TLS

In **end-to-end TLS**, traffic is encrypted both from the client to the Ingress and from the Ingress to the backend pods. This satisfies strict compliance requirements where data must be encrypted at every hop.

```
End-to-End TLS
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Client      Ingress Controller       Backend Pod              │
│  ┌──────┐   ┌───────────────────┐   ┌──────────────────────┐   │
│  │      │──▶│  TLS termination  │──▶│  HTTPS listener      │   │
│  │      │   │  (client cert)    │   │  (backend cert)      │   │
│  └──────┘   └───────────────────┘   └──────────────────────┘   │
│     HTTPS              HTTPS                                    │
│  encrypted          re-encrypted                                │
│                                                                 │
│  Standard TLS termination (for comparison):                     │
│  ┌──────┐   ┌───────────────────┐   ┌──────────────────────┐   │
│  │      │──▶│  TLS termination  │──▶│  HTTP listener       │   │
│  └──────┘   └───────────────────┘   └──────────────────────┘   │
│     HTTPS              HTTP                                     │
│  encrypted          plaintext                                   │
└─────────────────────────────────────────────────────────────────┘
```

```yaml
# NGINX Ingress: forward HTTPS to backend (backend must serve HTTPS)
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: e2e-tls-ingress
  annotations:
    # Tell NGINX to connect to backends via HTTPS
    nginx.ingress.kubernetes.io/backend-protocol: "HTTPS"
    # Skip backend certificate verification (for self-signed backend certs)
    nginx.ingress.kubernetes.io/proxy-ssl-verify: "off"
    # OR verify backend certificate using a CA
    nginx.ingress.kubernetes.io/proxy-ssl-secret: "default/backend-ca-secret"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - myapp.example.com
    secretName: myapp-tls
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
              number: 443                # Backend service exposes HTTPS
```

```bash
# Verify end-to-end TLS by checking backend pod certificate
kubectl exec -it myapp-pod -- openssl s_client \
  -connect myapp-service:443 \
  -servername myapp.example.com 2>/dev/null | \
  openssl x509 -text -noout | grep "Subject:"
```

---

## 8. Hands-On Exercises

**Exercise 1:** Generate a self-signed TLS certificate for `myapp.local` using openssl. Create a `kubernetes.io/tls` Secret named `myapp-tls` from the files. Apply an Ingress resource that references this secret in the `tls` section and adds the `nginx.ingress.kubernetes.io/ssl-redirect: "true"` annotation. Test with `curl -k https://myapp.local` (after adding the host to `/etc/hosts`). Confirm that HTTP requests are redirected to HTTPS.

**Exercise 2:** Install cert-manager using Helm with `installCRDs=true`. Verify all three cert-manager pods are Running (`cert-manager`, `cert-manager-cainjector`, `cert-manager-webhook`). Create a self-signed `ClusterIssuer` (using `selfSigned` solver instead of ACME — suitable for local testing). Then create a `Certificate` resource requesting a certificate for `test.local` from this issuer and observe the Secret being automatically created.

**Exercise 3:** Using the cert-manager staging Let's Encrypt issuer (requires a publicly accessible cluster with a real domain), create a `ClusterIssuer` pointing at the ACME staging server. Annotate an Ingress with `cert-manager.io/cluster-issuer: letsencrypt-staging`. Monitor the certificate issuance by running `kubectl get certificate -w` and `kubectl describe challenge` to observe the HTTP-01 challenge process. Confirm the staging certificate is issued (it will show an untrusted issuer — that is expected for staging).

**Exercise 4:** Investigate certificate expiry monitoring. Use `kubectl get certificate -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.notAfter}{"\n"}{end}'` to list all certificates and their expiry dates. Set a `renewBefore` of `720h` (30 days) on a Certificate resource and observe that cert-manager marks the certificate for renewal well before its expiry. Check `kubectl describe certificate` for the `Renewal Time` field.

**Exercise 5:** Configure end-to-end TLS for a backend service. Deploy a pod running nginx configured to listen on port 443 with a self-signed certificate. Create a Service exposing port 443. Update an Ingress to use `nginx.ingress.kubernetes.io/backend-protocol: "HTTPS"` and `nginx.ingress.kubernetes.io/proxy-ssl-verify: "off"`. Test with `curl -k https://myapp.example.com` and verify from the Ingress controller logs that it is connecting to the backend via HTTPS (look for `upstream` log lines showing port 443).

---

## 9. Interview Q&A

**Q: What is TLS termination and what are its advantages in Kubernetes?**
Answer: TLS termination means decrypting HTTPS traffic at the Ingress controller layer so that backend pods receive plain HTTP. Advantages include: backend services do not need to manage certificates or implement TLS, certificate rotation is centralised (update one Secret, all routes benefit), TLS handshake overhead is handled by the Ingress controller rather than every backend pod, and it simplifies compliance auditing since all external encryption is enforced at a single point. The main trade-off is that traffic inside the cluster is unencrypted — for strict security requirements, end-to-end TLS is needed.

**Q: What is cert-manager and how does it automate TLS certificate management?**
Answer: cert-manager is a Kubernetes operator that automates the issuance and renewal of TLS certificates. It introduces custom resources (`Certificate`, `Issuer`, `ClusterIssuer`) and integrates with certificate authorities like Let's Encrypt, HashiCorp Vault, Venafi, and self-signed issuers. When you annotate an Ingress with a `cert-manager.io/cluster-issuer` annotation, cert-manager detects the annotation, creates a `Certificate` resource, completes the ACME challenge (HTTP-01 or DNS-01), receives the certificate from the CA, stores it as a `kubernetes.io/tls` Secret, and automatically renews it before expiry. This eliminates manual certificate management entirely.

**Q: What is the difference between HTTP-01 and DNS-01 ACME challenges?**
Answer: Both challenges verify that you control a domain before Let's Encrypt issues a certificate. HTTP-01 works by cert-manager creating a temporary HTTP route at `/.well-known/acme-challenge/<token>` — Let's Encrypt fetches this URL to verify domain ownership. HTTP-01 requires port 80 to be publicly accessible and cannot issue wildcard certificates. DNS-01 works by cert-manager creating a TXT DNS record `_acme-challenge.<domain>` — Let's Encrypt queries DNS to verify the record. DNS-01 does not require any open ports and is the only method that can issue wildcard certificates (`*.example.com`), but it requires API access to your DNS provider.

**Q: What is a wildcard TLS certificate and when should you use one?**
Answer: A wildcard certificate is valid for all immediate subdomains of a domain (e.g., `*.example.com` covers `app.example.com`, `api.example.com`, `admin.example.com`, but NOT `app.sub.example.com`). You should use wildcard certificates when you have many subdomains under the same domain, as a single certificate covers all of them — reducing the number of certificate resources, simplifying rotation, and avoiding per-subdomain ACME challenges. They are particularly useful in multi-tenant platforms where new customer subdomains are created frequently. The trade-off is that a compromised wildcard certificate exposes all subdomains, and they require DNS-01 challenge which needs DNS API credentials.

**Q: What is end-to-end TLS and when is it required?**
Answer: End-to-end TLS means traffic is encrypted at every network hop — from the client to the Ingress, and also from the Ingress to the backend pods. Standard TLS termination leaves intra-cluster traffic unencrypted. End-to-end TLS is required in high-security environments where regulations mandate encryption in transit at all hops (e.g., PCI-DSS, HIPAA, financial services), in multi-tenant clusters where workloads from different tenants share the same network fabric, and when deploying in environments where the cluster network is not fully trusted. In Kubernetes, this is configured by setting the backend protocol annotation on the Ingress (e.g., `nginx.ingress.kubernetes.io/backend-protocol: HTTPS`) and running HTTPS servers in the backend pods.
