# Private Registries — Complete Guide

## Table of Contents
1. [Why Run a Private Registry](#1-why-run-a-private-registry)
2. [Deploying registry:2 Locally](#2-deploying-registry2-locally)
3. [Configuring TLS](#3-configuring-tls)
4. [Authentication with htpasswd](#4-authentication-with-htpasswd)
5. [Pushing and Pulling from a Private Registry](#5-pushing-and-pulling-from-a-private-registry)
6. [Registry Options Compared](#6-registry-options-compared)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Why Run a Private Registry

A private registry gives you full control over image distribution — who can push, who can pull, and how long images are retained.

```
Use cases for a private registry:

  ┌───────────────────────────────────────────────────────┐
  │  Private codebase  → images must not be publicly       │
  │                       accessible on Docker Hub         │
  │                                                        │
  │  Air-gapped network → no internet access; images       │
  │                       stored internally                │
  │                                                        │
  │  Pull-through cache → cache Docker Hub images locally  │
  │                       to avoid rate limits             │
  │                                                        │
  │  Compliance        → data sovereignty; images must     │
  │                       stay on-premises                 │
  │                                                        │
  │  Speed             → LAN pulls are faster than         │
  │                       pulling from the internet        │
  └───────────────────────────────────────────────────────┘
```

---

## 2. Deploying registry:2 Locally

The official `registry:2` image implements the Docker Registry HTTP API V2.

### Insecure (development only)

```bash
# Run registry on port 5000, data stored in a named volume
docker run -d \
  --name local-registry \
  --restart always \
  -p 5000:5000 \
  -v registry-data:/var/lib/registry \
  registry:2

# Verify it is running
curl http://localhost:5000/v2/
# {}   ← empty JSON means the registry is up

# Test: tag an image and push to localhost
docker tag nginx:alpine localhost:5000/nginx:alpine
docker push localhost:5000/nginx:alpine
# The push refers to repository [localhost:5000/nginx]
# alpine: digest: sha256:… size: 1234

# List repositories stored in the registry
curl http://localhost:5000/v2/_catalog
# {"repositories":["nginx"]}

# List tags for a specific repository
curl http://localhost:5000/v2/nginx/tags/list
# {"name":"nginx","tags":["alpine"]}
```

### Registry configuration file

```yaml
# /etc/docker/registry/config.yml (inside the container)
# Mount a custom config to override defaults:

version: 0.1
log:
  level: info
storage:
  filesystem:
    rootdirectory: /var/lib/registry
  delete:
    enabled: true        # allow DELETE API (needed for garbage collection)
http:
  addr: :5000
  secret: a-random-secret-string
```

```bash
docker run -d \
  --name local-registry \
  -p 5000:5000 \
  -v registry-data:/var/lib/registry \
  -v $(pwd)/config.yml:/etc/docker/registry/config.yml \
  registry:2
```

---

## 3. Configuring TLS

Without TLS the Docker daemon refuses to connect unless the registry is explicitly marked as insecure.

### Option A — Mark as insecure (dev only)

```json
// /etc/docker/daemon.json  (or Docker Desktop → Settings → Docker Engine)
{
  "insecure-registries": ["myregistry.internal:5000"]
}
```

```bash
# Restart daemon after editing
sudo systemctl restart docker
# macOS Docker Desktop: Restart from the tray icon
```

### Option B — Self-signed TLS (staging / internal)

```bash
# Generate a self-signed certificate for the registry hostname
mkdir -p certs
openssl req -newkey rsa:4096 -nodes -sha256 \
  -keyout certs/domain.key \
  -x509 -days 365 \
  -out certs/domain.crt \
  -subj "/CN=myregistry.internal"

# Run registry with TLS
docker run -d \
  --name secure-registry \
  --restart always \
  -p 443:5000 \
  -v registry-data:/var/lib/registry \
  -v $(pwd)/certs:/certs \
  -e REGISTRY_HTTP_TLS_CERTIFICATE=/certs/domain.crt \
  -e REGISTRY_HTTP_TLS_KEY=/certs/domain.key \
  registry:2

# Trust the self-signed cert on every Docker host that will push/pull
sudo mkdir -p /etc/docker/certs.d/myregistry.internal
sudo cp certs/domain.crt /etc/docker/certs.d/myregistry.internal/ca.crt
# No daemon restart needed — Docker reads certs.d at runtime
```

### TLS architecture

```
Developer / CI runner
      │
      │  HTTPS :443
      ▼
┌─────────────────────────────────────┐
│   registry:2 container              │
│   cert: /certs/domain.crt           │
│   key:  /certs/domain.key           │
│                                     │
│   /var/lib/registry  ←──────────────┼── volume: registry-data
│     blobs/
│     repositories/
└─────────────────────────────────────┘
```

---

## 4. Authentication with htpasswd

The `registry:2` image supports HTTP Basic Auth via the `htpasswd` file format.

```bash
# Create the auth directory and generate credentials
mkdir -p auth

# Use the registry image itself (contains htpasswd) to create the file
docker run --rm \
  --entrypoint htpasswd \
  httpd:2 \
  -Bbn ganesh supersecretpassword > auth/htpasswd

# Verify the file
cat auth/htpasswd
# ganesh:$2y$05$...bcrypt hash...

# Add a second user (append mode -n, no file flag)
docker run --rm --entrypoint htpasswd httpd:2 -Bbn ci-bot cipassword >> auth/htpasswd
```

### Run registry with TLS + htpasswd auth

```bash
docker run -d \
  --name secure-registry \
  --restart always \
  -p 443:5000 \
  -v registry-data:/var/lib/registry \
  -v $(pwd)/certs:/certs \
  -v $(pwd)/auth:/auth \
  -e REGISTRY_HTTP_TLS_CERTIFICATE=/certs/domain.crt \
  -e REGISTRY_HTTP_TLS_KEY=/certs/domain.key \
  -e REGISTRY_AUTH=htpasswd \
  -e REGISTRY_AUTH_HTPASSWD_REALM="Registry Realm" \
  -e REGISTRY_AUTH_HTPASSWD_PATH=/auth/htpasswd \
  registry:2
```

### Logging in and logging out

```bash
# Login to the private registry
docker login myregistry.internal

# Login non-interactively (CI)
echo "$REG_PASSWORD" | docker login myregistry.internal \
  --username ganesh --password-stdin

# Logout
docker logout myregistry.internal
```

### Access control model

```
registry:2 htpasswd = binary: can push+pull or cannot at all.
For fine-grained RBAC (per-repo, per-team):
  → Use Harbor (open source, replaces registry:2)
  → Or a managed service: ECR, GCR, ACR (see Section 6)

Harbor adds:
  - Role-based access control (project admin / developer / guest)
  - Image vulnerability scanning (Trivy)
  - Content trust and notary
  - Garbage collection UI
  - Replication to other registries
```

---

## 5. Pushing and Pulling from a Private Registry

```bash
# Image naming for a private registry:
#   <registry-host>:<port>/<namespace>/<repository>:<tag>

# Tag an image for your private registry
docker tag myapp:latest myregistry.internal/team-backend/myapp:v2.3.0
docker tag myapp:latest myregistry.internal/team-backend/myapp:latest

# Push
docker push myregistry.internal/team-backend/myapp:v2.3.0
docker push myregistry.internal/team-backend/myapp:latest

# Pull from another machine (must also have the TLS cert trusted)
docker pull myregistry.internal/team-backend/myapp:v2.3.0

# Delete an image from the registry (requires delete: enabled: true in config)
# Step 1: get the digest
DIGEST=$(curl -s \
  -H "Accept: application/vnd.docker.distribution.manifest.v2+json" \
  -u ganesh:supersecretpassword \
  "https://myregistry.internal/v2/team-backend/myapp/manifests/v2.3.0" \
  | jq -r '.config.digest')

# Step 2: delete by digest
curl -X DELETE \
  -u ganesh:supersecretpassword \
  "https://myregistry.internal/v2/team-backend/myapp/manifests/${DIGEST}"

# Step 3: run garbage collection to reclaim disk space
docker exec secure-registry \
  registry garbage-collect /etc/docker/registry/config.yml
```

---

## 6. Registry Options Compared

| Option | Hosting | Auth | RBAC | Scanning | Best For |
|--------|---------|------|------|----------|---------|
| `registry:2` | Self-hosted | htpasswd / token | None | None | Simple internal use |
| Harbor | Self-hosted | LDAP / OIDC | Yes | Trivy | Enterprise on-prem |
| Docker Hub | Cloud (Docker) | PAT | Org-level | Limited | Open source projects |
| AWS ECR | Cloud (AWS) | IAM roles | IAM policies | Inspector | AWS workloads |
| GCP Artifact Registry | Cloud (GCP) | IAM | IAM policies | Container Analysis | GCP workloads |
| Azure ACR | Cloud (Azure) | AAD / PAT | RBAC | Defender | Azure workloads |
| GitHub Container Registry (ghcr.io) | Cloud (GitHub) | PAT / GITHUB_TOKEN | GitHub permissions | — | GitHub-hosted projects |

---

## 7. Hands-On Exercises

**Exercise 1:** Run `registry:2` as an insecure registry on `localhost:5000`. Add `localhost:5000` to your daemon's `insecure-registries` list. Push `alpine:latest` to it as `localhost:5000/alpine:test` and confirm with `curl http://localhost:5000/v2/_catalog`.

**Exercise 2:** Generate a self-signed TLS certificate for `127.0.0.1`. Run `registry:2` with TLS on port 5443. Place the certificate in `/etc/docker/certs.d/127.0.0.1:5443/ca.crt`. Push and pull an image over HTTPS without using `insecure-registries`.

**Exercise 3:** Add htpasswd authentication to the registry from Exercise 2. Create two users: `admin` and `readonly`. Log in as `admin`, push an image. Log out, then try to pull without credentials — confirm a 401 response. Log in as `readonly` and pull successfully.

**Exercise 4:** Use the registry REST API to list all tags for a pushed repository: `curl -u admin:password https://127.0.0.1:5443/v2/<repo>/tags/list`. Then delete a specific tag and run garbage collection to reclaim disk space.

**Exercise 5:** Run Harbor using its official `docker-compose` installation (https://github.com/goharbor/harbor). Create a project, push an image under that project's namespace, then create a second user and assign it Guest role — verify they can pull but not push.

---

## 8. Interview Q&A

**Q: What is the Docker Registry HTTP API V2 and why does it matter?**
Answer: It is the standardised REST API that all OCI-compliant registries implement. It defines endpoints for listing repositories (`/v2/_catalog`), listing tags (`/v2/<name>/tags/list`), fetching manifests, and uploading/downloading blobs. Because all major registries (Docker Hub, ECR, GCR, registry:2) implement the same API, the Docker CLI works identically regardless of which registry you use — you only change the hostname in the image reference.

**Q: Why is TLS required for a production private registry?**
Answer: Without TLS, credentials (username/password) travel in plain text over the network and image layer data can be intercepted or modified in transit. The Docker daemon also refuses plain HTTP registries unless you explicitly whitelist them in `insecure-registries` — a setting that should never be used outside a trusted local network. TLS ensures confidentiality of credentials, integrity of image data, and authenticity of the registry server.

**Q: What are the limitations of htpasswd authentication in registry:2?**
Answer: htpasswd provides binary access control — a user either can or cannot interact with the registry; there is no per-repository or per-team permission model. It also requires a registry restart (or at least a container restart) to pick up credential changes, and there is no built-in UI or audit logging. For production use cases requiring RBAC, user management, and scanning, Harbor or a managed registry service (ECR, GCR, ACR) is the appropriate choice.

**Q: How does `registry garbage-collect` work?**
Answer: Deleting an image via the API only removes the manifest reference — the underlying blobs (layers) remain on disk. Garbage collection is a two-phase process: first it marks all blobs still referenced by at least one manifest, then it sweeps and deletes all unreferenced blobs. The registry must be put in read-only mode (or stopped) during garbage collection to prevent concurrent writes from corrupting the reference graph. Blobs are stored in `/var/lib/registry/docker/registry/v2/blobs/sha256/`.

**Q: How do you authenticate a Kubernetes pod to a private registry?**
Answer: You create a Kubernetes Secret of type `kubernetes.io/dockerconfigjson` containing the encoded registry credentials (the same format as `~/.docker/config.json`). Reference that secret in the pod spec under `imagePullSecrets`. When Kubelet schedules the pod it uses those credentials to pull the image. On AWS/GCP/Azure, the preferred approach is to attach an IAM role to the node (or use workload identity), so no long-lived credentials are required.
