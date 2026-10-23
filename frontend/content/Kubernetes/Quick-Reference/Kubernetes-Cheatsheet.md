---
# Kubernetes Quick Reference — Cheatsheet

---

### Cluster Info

```bash
# Show cluster endpoint and core service addresses
kubectl cluster-info

# List all nodes with IP, OS, kernel, and container runtime
kubectl get nodes -o wide

# List every resource across all namespaces
kubectl get all -A

# Show the full kubeconfig (merged from ~/.kube/config)
kubectl config view

# List all configured contexts (cluster + user + namespace triples)
kubectl config get-contexts

# Switch to a different context
kubectl config use-context my-eks-cluster

# Set the default namespace for the current context
kubectl config set-context --current --namespace=production

# List all API resource types and their shortnames
kubectl api-resources

# List all available API versions (for writing manifests)
kubectl api-versions | grep apps

# Show client and server version
kubectl version --short

# Check component health (scheduler, controller-manager, etcd)
kubectl get componentstatuses

# Show resource usage across the cluster
kubectl top nodes

# Count pods per node
kubectl get pods -A -o wide | awk '{print $8}' | sort | uniq -c | sort -rn
```

---

### Pod Commands

```bash
# Run a temporary pod (deleted when you exit)
kubectl run nginx --image=nginx:alpine --restart=Never --rm -it -- /bin/sh

# Run a pod with environment variables and resource limits
kubectl run my-pod --image=nginx:alpine \
  --env="ENV=production" \
  --requests="cpu=100m,memory=128Mi" \
  --limits="cpu=250m,memory=256Mi" \
  --restart=Never

# List pods in the current namespace
kubectl get pods

# List pods in a specific namespace with extra columns
kubectl get pods -n kube-system -o wide

# List pods with their labels shown
kubectl get pods --show-labels

# Get pods filtered by label selector
kubectl get pods -l app=my-app,env=production

# Describe a pod (events, conditions, container status)
kubectl describe pod my-pod-abc123 -n my-namespace

# Tail pod logs (last 100 lines, follow)
kubectl logs my-pod -f --tail=100

# Logs from a specific container in a multi-container pod
kubectl logs my-pod -c sidecar-container

# Logs from the previous (crashed) container instance
kubectl logs my-pod -c app --previous

# Open an interactive shell in a running container
kubectl exec -it my-pod -- /bin/bash

# Run a command in a specific container
kubectl exec -it my-pod -c sidecar -- /bin/sh -c "cat /etc/config/app.conf"

# Forward local port 8080 to pod port 3000
kubectl port-forward pod/my-pod 8080:3000

# Forward local port to a service (round-robin to pods)
kubectl port-forward svc/my-service 8080:80 -n my-namespace

# Force delete a stuck pod immediately
kubectl delete pod my-pod --grace-period=0 --force -n my-namespace

# Show CPU and memory usage for pods
kubectl top pod -n my-namespace

# Top pods sorted by CPU, showing individual containers
kubectl top pod -n my-namespace --sort-by=cpu --containers

# Get full pod spec as YAML (useful for debugging or templating)
kubectl get pod my-pod -o yaml

# Extract a specific field using JSONPath
kubectl get pod my-pod -o jsonpath='{.status.podIP}'

# Get all pod IPs in a namespace
kubectl get pods -n my-namespace -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.podIP}{"\n"}{end}'

# Watch pods update in real time
kubectl get pods -n my-namespace --watch

# List pods on a specific node
kubectl get pods -A --field-selector spec.nodeName=worker-node-1
```

---

### Deployment Commands

```bash
# Create a deployment imperatively
kubectl create deployment my-app --image=nginx:1.25 --replicas=3

# List all deployments
kubectl get deployments -n my-namespace

# List with additional columns (ready, up-to-date, available)
kubectl get deployments -o wide

# Describe a deployment (strategy, conditions, events)
kubectl describe deployment my-app -n my-namespace

# Scale a deployment to 5 replicas
kubectl scale deployment my-app --replicas=5 -n my-namespace

# Watch rollout progress after an update
kubectl rollout status deployment/my-app -n my-namespace

# View rollout revision history
kubectl rollout history deployment/my-app -n my-namespace

# View details of a specific revision
kubectl rollout history deployment/my-app --revision=3 -n my-namespace

# Roll back to the previous revision
kubectl rollout undo deployment/my-app -n my-namespace

# Roll back to a specific revision number
kubectl rollout undo deployment/my-app --to-revision=2 -n my-namespace

# Update the container image (triggers rolling update)
kubectl set image deployment/my-app app=nginx:1.26 -n my-namespace

# Pause a rollout mid-way (canary-style)
kubectl rollout pause deployment/my-app -n my-namespace

# Resume a paused rollout
kubectl rollout resume deployment/my-app -n my-namespace

# Restart all pods in a deployment (rolling restart, zero-downtime)
kubectl rollout restart deployment/my-app -n my-namespace

# Edit the deployment YAML in-editor
kubectl edit deployment my-app -n my-namespace

# Patch deployment with a JSON merge patch
kubectl patch deployment my-app -n my-namespace \
  --patch '{"spec": {"replicas": 2}}'

# Patch with strategic merge (add annotation)
kubectl patch deployment my-app -n my-namespace \
  -p '{"spec":{"template":{"metadata":{"annotations":{"kubectl.kubernetes.io/restartedAt":"'"$(date -u +%FT%TZ)"'"}}}}}'

# Delete a deployment (also deletes its ReplicaSet and pods)
kubectl delete deployment my-app -n my-namespace

# Generate deployment YAML without applying (dry run)
kubectl create deployment my-app --image=nginx:1.25 --replicas=3 \
  --dry-run=client -o yaml > deployment.yaml
```

---

### Service Commands

```bash
# Expose a deployment as a ClusterIP service on port 80 → 8080
kubectl expose deployment my-app --port=80 --target-port=8080 --name=my-app-svc

# Expose as a NodePort service
kubectl expose deployment my-app --port=80 --target-port=8080 \
  --type=NodePort --name=my-app-nodeport

# Create a LoadBalancer service imperatively
kubectl create service loadbalancer my-app-lb --tcp=80:8080 -n my-namespace

# List all services with their types and cluster IPs
kubectl get services -n my-namespace
kubectl get svc -n my-namespace -o wide

# Describe a service (endpoints, selectors, ports)
kubectl describe service my-app-svc -n my-namespace

# Get the NodePort assigned to a service
kubectl get svc my-app-nodeport -o jsonpath='{.spec.ports[0].nodePort}'

# List all endpoints (pod IPs backing a service)
kubectl get endpoints -n my-namespace
kubectl describe endpoints my-app-svc -n my-namespace

# Get the external IP of a LoadBalancer service
kubectl get svc my-app-lb -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'

# Delete a service
kubectl delete service my-app-svc -n my-namespace

# Port-forward a service locally for testing
kubectl port-forward svc/my-app-svc 8080:80 -n my-namespace
```

---

### Namespace Commands

```bash
# Create a new namespace
kubectl create namespace staging

# List all namespaces
kubectl get namespaces
kubectl get ns

# Describe a namespace (resource quotas, limit ranges)
kubectl describe namespace production

# Set default namespace for current context (persists across commands)
kubectl config set-context --current --namespace=staging

# Run a command in a specific namespace
kubectl get pods -n kube-system

# Get resources across ALL namespaces (the -A flag)
kubectl get pods -A
kubectl get services -A
kubectl get ingress -A

# Delete a namespace (WARNING: deletes ALL resources inside it)
kubectl delete namespace staging

# Create a namespace from YAML
kubectl apply -f - <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: staging
  labels:
    env: staging
    team: platform
EOF
```

---

### ConfigMap & Secret

```bash
# ----- ConfigMaps -----

# Create a ConfigMap from literal key-value pairs
kubectl create configmap app-config \
  --from-literal=DATABASE_HOST=postgres.default.svc \
  --from-literal=LOG_LEVEL=info \
  -n my-namespace

# Create a ConfigMap from a single file (key = filename)
kubectl create configmap nginx-conf --from-file=nginx.conf -n my-namespace

# Create from a directory (all files become keys)
kubectl create configmap app-configs --from-file=./configs/ -n my-namespace

# Create from an env file (KEY=VALUE format)
kubectl create configmap env-config --from-env-file=.env.production -n my-namespace

# View a ConfigMap
kubectl get configmap app-config -n my-namespace
kubectl describe configmap app-config -n my-namespace
kubectl get configmap app-config -o yaml -n my-namespace

# ----- Secrets -----

# Create a generic secret from literals (base64-encoded automatically)
kubectl create secret generic db-credentials \
  --from-literal=username=admin \
  --from-literal=password='S3cure!Pass' \
  -n my-namespace

# Create a secret from files
kubectl create secret generic tls-certs \
  --from-file=tls.crt=./certs/server.crt \
  --from-file=tls.key=./certs/server.key \
  -n my-namespace

# Create a TLS secret directly
kubectl create secret tls my-tls-secret \
  --cert=./certs/server.crt \
  --key=./certs/server.key \
  -n my-namespace

# List secrets
kubectl get secrets -n my-namespace

# Decode a specific secret value from base64
kubectl get secret db-credentials -n my-namespace \
  -o jsonpath='{.data.password}' | base64 --decode

# View all secret keys (without revealing values)
kubectl describe secret db-credentials -n my-namespace

# Delete resources
kubectl delete configmap app-config -n my-namespace
kubectl delete secret db-credentials -n my-namespace
```

---

### Storage

```bash
# List all PersistentVolumes (cluster-scoped, no namespace)
kubectl get pv
kubectl get pv -o wide

# List all PersistentVolumeClaims in a namespace
kubectl get pvc -n my-namespace
kubectl get pvc -A                    # Across all namespaces

# Describe a PVC to see binding status and events
kubectl describe pvc my-data-pvc -n my-namespace

# Check which PV a PVC is bound to
kubectl get pvc my-data-pvc -n my-namespace \
  -o jsonpath='{.spec.volumeName}'

# List available StorageClasses
kubectl get storageclass
kubectl get sc

# Describe a StorageClass (provisioner, reclaim policy, volume binding mode)
kubectl describe storageclass standard

# Mark a StorageClass as default
kubectl patch storageclass standard \
  -p '{"metadata": {"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'

# Delete a PVC (will also trigger PV deletion if reclaim policy is Delete)
kubectl delete pvc my-data-pvc -n my-namespace

# Get PVs that are in Released state (not yet reclaimed)
kubectl get pv --field-selector=status.phase=Released

# Force delete a stuck PVC by removing its finalizer
kubectl patch pvc stuck-pvc -n my-namespace \
  -p '{"metadata":{"finalizers":null}}'
```

---

### RBAC

```bash
# Create a ServiceAccount
kubectl create serviceaccount ci-deployer -n my-namespace

# Create a ClusterRole with specific permissions
kubectl create clusterrole pod-reader \
  --verb=get,list,watch \
  --resource=pods,pods/log

# Bind a ClusterRole to a user cluster-wide
kubectl create clusterrolebinding pod-reader-binding \
  --clusterrole=pod-reader \
  --user=jane@example.com

# Create a namespace-scoped Role
kubectl create role deploy-manager \
  --verb=get,list,watch,create,update,patch,delete \
  --resource=deployments,replicasets \
  -n my-namespace

# Bind the Role to a ServiceAccount in the same namespace
kubectl create rolebinding deploy-manager-binding \
  --role=deploy-manager \
  --serviceaccount=my-namespace:ci-deployer \
  -n my-namespace

# Bind a ClusterRole to a ServiceAccount (namespace-scoped binding)
kubectl create rolebinding view-binding \
  --clusterrole=view \
  --serviceaccount=my-namespace:my-sa \
  -n my-namespace

# List all ClusterRoleBindings
kubectl get clusterrolebindings

# List RoleBindings in a namespace
kubectl get rolebindings -n my-namespace

# Check if a user/SA can perform an action
kubectl auth can-i create deployments --as=jane@example.com -n my-namespace
kubectl auth can-i list pods --as=system:serviceaccount:my-namespace:ci-deployer

# List all permissions for the current user
kubectl auth can-i --list
kubectl auth can-i --list -n my-namespace

# Inspect what a ServiceAccount token can do
kubectl auth can-i '*' '*' --as=system:serviceaccount:kube-system:coredns
```

---

### Helm

```bash
# Add a chart repository
helm repo add stable https://charts.helm.sh/stable
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx

# Update all repo indexes
helm repo update

# List configured repos
helm repo list

# Search for charts in configured repos
helm search repo nginx
helm search repo bitnami/postgres --versions

# Install a chart with a release name
helm install my-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace

# Install with custom values file
helm install my-release bitnami/postgresql \
  --namespace databases \
  -f values-production.yaml \
  --set primary.persistence.size=50Gi

# Dry run to preview what would be installed
helm install my-release bitnami/redis --dry-run --debug

# Upgrade an existing release (install if not present)
helm upgrade --install my-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --set controller.replicaCount=2 \
  --wait --timeout 5m

# List all installed releases
helm list -A

# Get the status of a release
helm status my-release -n databases

# Get the computed values for a release
helm get values my-release -n databases
helm get values my-release -n databases --all   # Include default values

# Roll back to a previous release revision
helm rollback my-release 1 -n databases

# Uninstall a release (deletes all Kubernetes resources)
helm uninstall my-release -n databases

# Render templates locally without installing (for debugging)
helm template my-release bitnami/postgresql -f values.yaml

# Lint a local chart for errors
helm lint ./my-chart/

# Package a local chart into a .tgz archive
helm package ./my-chart/

# Push to an OCI registry (Helm v3.8+)
helm push my-chart-1.0.0.tgz oci://ghcr.io/YOUR_ORG/helm-charts

# Pull a chart locally for inspection
helm pull bitnami/postgresql --untar --untardir ./charts/
```

---

### Ingress

```bash
# List all Ingress resources
kubectl get ingress -A
kubectl get ingress -n my-namespace

# Describe an Ingress (rules, backends, TLS)
kubectl describe ingress my-app-ingress -n my-namespace

# Get the IP or hostname assigned to an Ingress
kubectl get ingress my-app-ingress -n my-namespace \
  -o jsonpath='{.status.loadBalancer.ingress[0].ip}'

# Create an Ingress imperatively (HTTP, no TLS)
kubectl create ingress my-app-ingress \
  --rule="my-app.example.com/=my-app-svc:80" \
  -n my-namespace

# Create an Ingress with multiple rules and TLS
kubectl create ingress multi-ingress \
  --rule="api.example.com/=api-svc:8080,tls=api-tls-secret" \
  --rule="www.example.com/=frontend-svc:80" \
  -n my-namespace

# Common nginx ingress annotations (applied to metadata.annotations in YAML)
# nginx.ingress.kubernetes.io/rewrite-target: /
# nginx.ingress.kubernetes.io/ssl-redirect: "true"
# nginx.ingress.kubernetes.io/proxy-body-size: "50m"
# nginx.ingress.kubernetes.io/proxy-read-timeout: "60"
# nginx.ingress.kubernetes.io/rate-limit: "100"
# nginx.ingress.kubernetes.io/use-regex: "true"
# nginx.ingress.kubernetes.io/backend-protocol: "HTTPS"
# nginx.ingress.kubernetes.io/whitelist-source-range: "10.0.0.0/8"

# Get logs from the ingress controller
kubectl logs -n ingress-nginx \
  -l app.kubernetes.io/name=ingress-nginx \
  --tail=50 -f

# Watch for Ingress changes
kubectl get ingress -n my-namespace --watch
```

---

### Autoscaling

```bash
# Create a HorizontalPodAutoscaler targeting CPU 70%
kubectl autoscale deployment my-app \
  --min=2 --max=10 --cpu-percent=70 \
  -n my-namespace

# List HPAs
kubectl get hpa -n my-namespace

# Describe HPA (current metrics, desired replicas)
kubectl describe hpa my-app -n my-namespace

# Delete HPA
kubectl delete hpa my-app -n my-namespace

# HPA scaling on custom metrics (YAML required)
# Example: scale on requests-per-second via Prometheus adapter
# ---
# apiVersion: autoscaling/v2
# kind: HorizontalPodAutoscaler
# metadata:
#   name: my-app-hpa
# spec:
#   scaleTargetRef:
#     apiVersion: apps/v1
#     kind: Deployment
#     name: my-app
#   minReplicas: 2
#   maxReplicas: 20
#   metrics:
#   - type: Resource
#     resource:
#       name: cpu
#       target:
#         type: Utilization
#         averageUtilization: 70
#   - type: Resource
#     resource:
#       name: memory
#       target:
#         type: AverageValue
#         averageValue: 200Mi

# VerticalPodAutoscaler (VPA) — requires VPA CRDs installed
# kubectl apply -f https://github.com/kubernetes/autoscaler/releases/latest/download/vertical-pod-autoscaler.yaml
# Example VPA resource:
# apiVersion: autoscaling.k8s.io/v1
# kind: VerticalPodAutoscaler
# metadata:
#   name: my-app-vpa
# spec:
#   targetRef:
#     apiVersion: apps/v1
#     kind: Deployment
#     name: my-app
#   updatePolicy:
#     updateMode: "Auto"    # Auto/Off/Initial

# KEDA ScaledObject — scale on Kafka lag, queue depth, etc.
# Example: scale based on Azure Service Bus queue length
# apiVersion: keda.sh/v1alpha1
# kind: ScaledObject
# metadata:
#   name: my-app-keda
# spec:
#   scaleTargetRef:
#     name: my-app
#   minReplicaCount: 0
#   maxReplicaCount: 50
#   triggers:
#   - type: azure-servicebus
#     metadata:
#       queueName: my-queue
#       messageCount: "5"

# Get VPA recommendations
kubectl get vpa -n my-namespace -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{.status.recommendation}{"\n\n"}{end}'
```

---

### Debugging

```bash
# Show all events sorted by time (great first debugging step)
kubectl get events -n my-namespace --sort-by='.lastTimestamp'
kubectl get events -A --sort-by='.metadata.creationTimestamp' | tail -30

# Watch events in real time
kubectl get events -n my-namespace -w

# Describe a node (conditions, capacity, allocated resources)
kubectl describe node worker-node-1

# Show resource usage per node
kubectl top nodes

# Show resource usage per pod
kubectl top pods -n my-namespace

# Show resource usage per container within each pod
kubectl top pods -n my-namespace --containers

# Get the pod with most CPU usage
kubectl top pods -A --sort-by=cpu | head -5

# Show which node each pod is on
kubectl get pod -o wide -n my-namespace

# Debug network: exec into a pod and curl another service
kubectl exec -it debug-pod -n my-namespace -- \
  curl -v http://my-service.other-namespace.svc.cluster.local/healthz

# Run a temporary debug pod with network tools (netshoot)
kubectl run netshoot --rm -it \
  --image=nicolaka/netshoot \
  --restart=Never \
  -- /bin/bash

# Debug a specific node by running a privileged pod on it
kubectl debug node/worker-node-1 \
  -it \
  --image=ubuntu \
  -- chroot /host bash

# Attach to an existing container's STDIN/STDOUT
kubectl attach my-pod -c my-container -it

# Copy files into/out of a pod
kubectl cp my-pod:/var/log/app.log ./local-app.log -n my-namespace
kubectl cp ./config.json my-pod:/etc/app/config.json -n my-namespace

# Check DNS resolution from within the cluster
kubectl run dns-test --rm -it \
  --image=busybox:1.35 \
  --restart=Never \
  -- nslookup kubernetes.default.svc.cluster.local

# Show which containers in a pod have been restarting
kubectl get pod my-pod -n my-namespace \
  -o jsonpath='{range .status.containerStatuses[*]}{.name}{" restarts="}{.restartCount}{"\n"}{end}'
```

---

### Useful Flags & JSONPath

```bash
# Generate YAML manifest without applying (dry run) — great for templating
kubectl create deployment my-app --image=nginx --dry-run=client -o yaml

# Shorthand namespace flags
kubectl get pods -n kube-system                    # specific namespace
kubectl get pods -A                                # all namespaces

# Label selector filter (AND logic between comma-separated pairs)
kubectl get pods -l app=my-app,env=production
kubectl get pods -l 'tier in (frontend,backend)'   # set-based
kubectl get pods -l 'version notin (v1)'

# Output formats
kubectl get deployment my-app -o wide              # extra columns
kubectl get deployment my-app -o json              # full JSON
kubectl get deployment my-app -o yaml              # full YAML
kubectl get deployment my-app -o name              # just the resource name
kubectl get pods -o jsonpath='{.items[*].metadata.name}'
kubectl get pods -o custom-columns=NAME:.metadata.name,STATUS:.status.phase,NODE:.spec.nodeName

# JSONPath examples — extracting specific fields
kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.nodeInfo.kubeletVersion}{"\n"}{end}'
kubectl get pods -n my-namespace -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.podIP}{"\n"}{end}'
kubectl get secret my-secret -o jsonpath='{.data.password}' | base64 --decode

# Field selector — filter by resource fields
kubectl get pods --field-selector=status.phase=Running
kubectl get pods --field-selector=spec.nodeName=worker-node-1
kubectl get events --field-selector=type=Warning

# Watch resources for changes
kubectl get pods --watch
kubectl get pods -w -n my-namespace

# Show labels on resources
kubectl get pods --show-labels
kubectl get nodes --show-labels

# Sort output by a field
kubectl get pods --sort-by='.metadata.creationTimestamp'
kubectl get pods --sort-by='.status.startTime'

# Apply with server-side dry run (tests admission webhooks too)
kubectl apply -f deployment.yaml --dry-run=server

# Diff what would change before applying
kubectl diff -f deployment.yaml

# Annotate a resource
kubectl annotate deployment my-app kubernetes.io/change-cause="bumped to v1.2" --overwrite

# Label a resource
kubectl label pod my-pod app=my-app env=production

# Remove a label
kubectl label pod my-pod env-

# Force replace a resource (delete + recreate — use with caution)
kubectl replace --force -f deployment.yaml
```

---
