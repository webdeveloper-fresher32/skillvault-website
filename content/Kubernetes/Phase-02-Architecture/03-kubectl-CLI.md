# kubectl CLI — Complete Guide

## Table of Contents
1. [kubectl Overview](#1-kubectl-overview)
2. [kubectl Configuration and Contexts](#2-kubectl-configuration-and-contexts)
3. [Namespaces](#3-namespaces)
4. [Core Commands](#4-core-commands)
5. [Output Formats](#5-output-formats)
6. [Imperative vs Declarative](#6-imperative-vs-declarative)
7. [Advanced kubectl Usage](#7-advanced-kubectl-usage)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. kubectl Overview

kubectl (pronounced "cube-control" or "cube-C-T-L") is the Kubernetes command-line tool. It converts your commands into REST API calls to the kube-apiserver.

```
You type:   kubectl get pods
                │
                ▼
kubectl reads ~/.kube/config
  → finds current context
  → gets API server URL + credentials
                │
                ▼
HTTPS GET https://192.168.49.2:8443/api/v1/namespaces/default/pods
  Authorization: Bearer <token>
                │
                ▼
kube-apiserver authenticates → authorises → returns Pod list
                │
                ▼
kubectl formats and prints the output
```

### kubectl Command Structure

```
kubectl  <verb>  <resource>  [name]  [flags]

Examples:
kubectl  get      pods
kubectl  get      pod          my-pod
kubectl  get      pods                  -n kube-system
kubectl  describe deployment  my-deploy
kubectl  apply                          -f manifest.yaml
kubectl  delete   service     my-svc
kubectl  logs     pod         my-pod    -c container-name
kubectl  exec     pod         my-pod    -- bash
```

---

## 2. kubectl Configuration and Contexts

### kubeconfig File

kubectl uses `~/.kube/config` to store connection details for all your clusters.

```bash
# Show current context
kubectl config current-context

# List all contexts
kubectl config get-contexts

# Switch context
kubectl config use-context my-cluster

# Show the entire kubeconfig
kubectl config view

# Show only the current context config
kubectl config view --minify

# Rename a context
kubectl config rename-context old-name new-name

# Delete a context
kubectl config delete-context old-cluster

# Set namespace permanently for current context
kubectl config set-context --current --namespace=my-namespace
```

### Working with Multiple Clusters

```bash
# Merge two kubeconfig files
export KUBECONFIG=~/.kube/config:~/.kube/work-config
kubectl config view --merge --flatten > ~/.kube/merged-config
mv ~/.kube/merged-config ~/.kube/config

# Switch clusters quickly with kubectx (install: brew install kubectx)
kubectx                      # list contexts
kubectx my-production        # switch to production
kubectx -                    # switch to previous context

# Switch namespaces with kubens
kubens                       # list namespaces
kubens kube-system           # switch to kube-system namespace
```

### Shell Setup (add to ~/.zshrc or ~/.bashrc)

```bash
# kubectl completion
source <(kubectl completion zsh)   # or bash
complete -F __start_kubectl k

# Useful aliases
alias k='kubectl'
alias kgp='kubectl get pods'
alias kgpa='kubectl get pods -A'
alias kgs='kubectl get svc'
alias kgn='kubectl get nodes'
alias kgd='kubectl get deploy'
alias kdp='kubectl describe pod'
alias kaf='kubectl apply -f'
alias kdf='kubectl delete -f'
alias klog='kubectl logs -f'
alias kex='kubectl exec -it'

# Show current context in shell prompt (with kube-ps1)
# brew install kube-ps1
source "$(brew --prefix)/opt/kube-ps1/share/kube-ps1.sh"
PS1='$(kube_ps1) '$PS1
```

---

## 3. Namespaces

Namespaces provide virtual clusters within a physical cluster — a way to isolate resources between teams, environments, or applications.

```
Kubernetes Cluster
├── namespace: default          ← where resources go if unspecified
├── namespace: kube-system      ← Kubernetes system components
├── namespace: kube-public      ← publicly readable cluster info
├── namespace: kube-node-lease  ← node heartbeat objects
├── namespace: development      ← your dev resources
├── namespace: staging          ← your staging resources
└── namespace: production       ← your prod resources
```

### Namespace Commands

```bash
# List namespaces
kubectl get namespaces
kubectl get ns

# Create a namespace
kubectl create namespace development
# or declaratively:
kubectl apply -f - <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: development
  labels:
    env: dev
EOF

# Run commands in a specific namespace
kubectl get pods -n kube-system
kubectl get pods --namespace=kube-system
kubectl get pods -n development

# Run commands across ALL namespaces
kubectl get pods -A
kubectl get pods --all-namespaces

# Set default namespace for current session (per context)
kubectl config set-context --current --namespace=development

# Delete a namespace (and everything in it!)
kubectl delete namespace old-development
```

### What Is and Isn't Namespaced

```bash
# Namespaced resources (scoped to a namespace)
kubectl api-resources --namespaced=true
# → pods, services, deployments, configmaps, secrets, ingresses, etc.

# Cluster-scoped resources (exist at cluster level)
kubectl api-resources --namespaced=false
# → nodes, persistentvolumes, clusterroles, namespaces, storageclasses
```

---

## 4. Core Commands

### get — List Resources

```bash
# Basic get
kubectl get pods
kubectl get services
kubectl get deployments
kubectl get nodes
kubectl get all          # pods, services, deployments, replicasets

# Get with extra info
kubectl get pods -o wide          # show node, IP, etc.
kubectl get pods --show-labels    # show all labels

# Get specific resource
kubectl get pod my-pod
kubectl get pod/my-pod            # same thing

# Watch for changes (live updates)
kubectl get pods -w
kubectl get pods --watch

# Multiple resource types at once
kubectl get pods,services,deployments

# Get with field selector
kubectl get pods --field-selector=status.phase=Running
kubectl get pods --field-selector=spec.nodeName=worker-1

# Get with label selector
kubectl get pods -l app=nginx
kubectl get pods -l 'app in (nginx,redis)'
kubectl get pods -l app=nginx,version=v2
```

### describe — Inspect a Resource

```bash
# Describe shows detailed info: spec, status, events
kubectl describe pod my-pod
kubectl describe node worker-1
kubectl describe deployment my-deploy
kubectl describe service my-svc

# Events section is the most useful for debugging:
# Events:
#   Warning  BackOff   3m   kubelet  Back-off restarting failed container
#   Warning  Failed    3m   kubelet  Failed to pull image "myapp:v99"
```

### apply — Create or Update Resources

```bash
# Apply a single file
kubectl apply -f pod.yaml

# Apply a directory (all YAML files)
kubectl apply -f ./k8s/

# Apply from stdin
kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: quick-pod
spec:
  containers:
  - name: nginx
    image: nginx:1.25
EOF

# Apply from a URL
kubectl apply -f https://raw.githubusercontent.com/example/repo/main/deploy.yaml

# Dry run (validate without applying)
kubectl apply -f deploy.yaml --dry-run=client
kubectl apply -f deploy.yaml --dry-run=server   # server-side validation

# Diff — see what would change
kubectl diff -f deploy.yaml
```

### delete — Remove Resources

```bash
# Delete by file
kubectl delete -f pod.yaml

# Delete by resource type and name
kubectl delete pod my-pod
kubectl delete deployment my-deploy
kubectl delete svc,deploy -l app=nginx   # delete by label

# Delete all of a type in a namespace
kubectl delete pods --all
kubectl delete pods --all -n development

# Force delete (skip graceful termination — use with caution)
kubectl delete pod my-pod --force --grace-period=0

# Delete a namespace and all its contents
kubectl delete namespace old-dev
```

### logs — View Container Output

```bash
# Basic logs
kubectl logs my-pod

# Stream logs (follow)
kubectl logs my-pod -f
kubectl logs my-pod --follow

# Last N lines
kubectl logs my-pod --tail=100

# Logs since a time
kubectl logs my-pod --since=1h
kubectl logs my-pod --since-time="2024-01-15T10:00:00Z"

# Logs from a specific container (multi-container pod)
kubectl logs my-pod -c sidecar-container

# Logs from a crashed previous container
kubectl logs my-pod --previous
kubectl logs my-pod -p

# Logs from all Pods in a Deployment (using label)
kubectl logs -l app=nginx --all-containers=true
```

### exec — Run Commands in a Container

```bash
# Open a shell
kubectl exec -it my-pod -- bash
kubectl exec -it my-pod -- sh     # if bash not available

# Run a one-off command
kubectl exec my-pod -- cat /etc/os-release
kubectl exec my-pod -- ls /app
kubectl exec my-pod -- env

# Specify container in multi-container pod
kubectl exec -it my-pod -c nginx -- bash

# Copy files to/from a pod
kubectl cp my-pod:/app/logs/error.log ./error.log
kubectl cp ./config.yaml my-pod:/app/config.yaml
```

### port-forward — Local Access to Cluster Resources

```bash
# Forward a pod port to localhost
kubectl port-forward pod/my-pod 8080:80
# → access via http://localhost:8080

# Forward a service port (routes to one of the Pods)
kubectl port-forward svc/my-service 8080:80

# Forward a deployment
kubectl port-forward deployment/my-deploy 8080:80

# Bind to a specific local address
kubectl port-forward svc/my-service 8080:80 --address=0.0.0.0

# Useful for: accessing dashboards, databases, debug endpoints
# without exposing them to the internet
kubectl port-forward svc/kubernetes-dashboard 8080:443 -n kubernetes-dashboard
kubectl port-forward svc/prometheus 9090:9090 -n monitoring
```

### Other Useful Commands

```bash
# Scale a deployment
kubectl scale deployment my-app --replicas=5

# Update a container image (triggers rolling update)
kubectl set image deployment/my-app nginx=nginx:1.26

# Rollout status and history
kubectl rollout status deployment/my-app
kubectl rollout history deployment/my-app
kubectl rollout undo deployment/my-app
kubectl rollout undo deployment/my-app --to-revision=2

# Edit a resource in your default editor
kubectl edit deployment my-app
kubectl edit configmap my-config

# Top — resource usage (requires metrics-server)
kubectl top nodes
kubectl top pods
kubectl top pods --sort-by=memory
kubectl top pods -l app=nginx

# Explain — built-in docs for any field
kubectl explain pod
kubectl explain pod.spec
kubectl explain pod.spec.containers.livenessProbe
```

---

## 5. Output Formats

kubectl supports multiple output formats with `-o`.

```bash
# Default: human-readable table
kubectl get pods

# Wide: extra columns (node, IP, etc.)
kubectl get pods -o wide

# YAML: full object definition
kubectl get pod my-pod -o yaml
kubectl get deployment my-app -o yaml

# JSON: full object in JSON
kubectl get pod my-pod -o json

# Name only (useful for scripting)
kubectl get pods -o name
# pod/my-pod-1
# pod/my-pod-2

# Custom columns
kubectl get pods -o custom-columns=NAME:.metadata.name,STATUS:.status.phase,NODE:.spec.nodeName

# jsonpath: extract specific fields
kubectl get pod my-pod -o jsonpath='{.status.podIP}'
kubectl get pods -o jsonpath='{.items[*].metadata.name}'
kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.capacity.cpu}{"\n"}{end}'

# go-template
kubectl get pods -o go-template='{{range .items}}{{.metadata.name}}{{"\n"}}{{end}}'

# Sorting
kubectl get pods --sort-by=.metadata.creationTimestamp
kubectl get pods --sort-by=.status.startTime
```

---

## 6. Imperative vs Declarative

Kubernetes supports two approaches to managing resources.

### Imperative Commands

You tell Kubernetes what action to perform:

```bash
# Create resources
kubectl run nginx --image=nginx:1.25
kubectl create deployment myapp --image=myapp:1.0 --replicas=3
kubectl create service nodeport myapp --tcp=80:8080
kubectl create configmap myconfig --from-literal=KEY=VALUE
kubectl create secret generic mysecret --from-literal=password=abc123

# Update resources
kubectl scale deployment myapp --replicas=5
kubectl set image deployment/myapp myapp=myapp:2.0
kubectl label pod my-pod env=production
kubectl annotate pod my-pod description="web server"

# Good for: quick one-off tasks, learning, generating YAML templates
```

### Declarative Manifests

You describe the desired state in YAML:

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
  labels:
    app: myapp
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
      - name: myapp
        image: myapp:1.0
        ports:
        - containerPort: 8080
        resources:
          requests:
            cpu: "100m"
            memory: "128Mi"
          limits:
            cpu: "500m"
            memory: "512Mi"
```

```bash
# Apply: create if not exists, update if exists
kubectl apply -f deployment.yaml

# Always prefer declarative in production:
# → Files can be versioned in Git (GitOps)
# → Changes are auditable
# → Reproducible across environments
```

### Generating YAML from Imperative Commands

```bash
# Generate YAML without applying (--dry-run + -o yaml)
kubectl run nginx --image=nginx:1.25 --dry-run=client -o yaml
kubectl create deployment myapp --image=myapp:1.0 --replicas=3 --dry-run=client -o yaml
kubectl create service clusterip myapp --tcp=80:8080 --dry-run=client -o yaml
kubectl create configmap myconfig --from-literal=KEY=VALUE --dry-run=client -o yaml

# Save to file and customise
kubectl create deployment myapp --image=myapp:1.0 --replicas=3 --dry-run=client -o yaml > deploy.yaml
# Edit deploy.yaml to add probes, resource limits, etc.
kubectl apply -f deploy.yaml
```

---

## 7. Advanced kubectl Usage

### Debugging Techniques

```bash
# Get events (sorted by time)
kubectl get events --sort-by=.metadata.creationTimestamp
kubectl get events -n my-namespace --field-selector=reason=Failed

# Debug a crashing pod
kubectl describe pod crashing-pod    # look at Events and State
kubectl logs crashing-pod --previous # logs from last crash
kubectl logs crashing-pod -f         # stream current logs

# Start a debug container in a running pod (K8s 1.23+)
kubectl debug -it my-pod --image=busybox --target=my-container

# Run a temporary debug pod
kubectl run debug --image=busybox --rm -it -- sh
kubectl run curl --image=curlimages/curl --rm -it -- sh

# Check DNS resolution from inside the cluster
kubectl run dnstest --image=busybox --rm -it -- nslookup my-service
kubectl run dnstest --image=busybox --rm -it -- nslookup my-service.default.svc.cluster.local
```

### Kubectl Plugins (Krew)

```bash
# Install Krew (kubectl plugin manager)
# https://krew.sigs.k8s.io/docs/user-guide/setup/install/

# Search plugins
kubectl krew search

# Install useful plugins
kubectl krew install ctx        # alias for kubectx
kubectl krew install ns         # alias for kubens
kubectl krew install neat       # clean up kubectl output
kubectl krew install tree       # display resource hierarchy
kubectl krew install resource-capacity  # node resource usage

# Use plugins
kubectl neat get pod my-pod -o yaml   # clean output without managed fields
kubectl tree deployment my-app        # show ReplicaSet and Pods hierarchy
```

---

## 8. Hands-On Exercises

**Exercise 1:** Set up kubectl aliases and completion. Add the alias block from Section 2 to your ~/.zshrc or ~/.bashrc. Reload your shell (`source ~/.zshrc`). Test that `k get pods` works. Run `k explain pod.spec.containers` to explore built-in documentation.

**Exercise 2:** Practice namespace isolation. Create two namespaces: `kubectl create namespace team-a` and `kubectl create namespace team-b`. Deploy nginx into each: `kubectl create deployment nginx --image=nginx -n team-a` and `kubectl create deployment nginx --image=nginx -n team-b`. Run `kubectl get pods -A` to see all pods. Notice both are named `nginx` but live in separate namespaces.

**Exercise 3:** Practice all output formats. Get a running Pod's full YAML: `kubectl get pod <name> -o yaml`. Extract its IP with jsonpath: `kubectl get pod <name> -o jsonpath='{.status.podIP}'`. List all pod names: `kubectl get pods -o jsonpath='{.items[*].metadata.name}'`. Try custom columns: `kubectl get pods -o custom-columns=NAME:.metadata.name,IP:.status.podIP`.

**Exercise 4:** Generate manifests from imperative commands. Run: `kubectl create deployment webapp --image=nginx:1.25 --replicas=2 --dry-run=client -o yaml > webapp.yaml`. Open `webapp.yaml`, add a liveness probe (httpGet /, port 80, initialDelaySeconds: 10), add resource requests (cpu: 100m, memory: 128Mi) and limits. Apply it: `kubectl apply -f webapp.yaml`.

**Exercise 5:** Practice rollouts. Create a deployment with `kubectl create deployment rollout-demo --image=nginx:1.24`. Update the image: `kubectl set image deployment/rollout-demo nginx=nginx:1.25`. Watch the rollout: `kubectl rollout status deployment/rollout-demo`. View rollout history: `kubectl rollout history deployment/rollout-demo`. Roll back: `kubectl rollout undo deployment/rollout-demo`. Verify the image reverted with `kubectl get deployment rollout-demo -o jsonpath='{.spec.template.spec.containers[0].image}'`.

---

## 9. Interview Q&A

**Q: What is the difference between `kubectl apply` and `kubectl create`?**
Answer: `kubectl create` is imperative — it creates the resource and fails if it already exists. `kubectl apply` is declarative — it creates the resource if it doesn't exist, or updates it if it does. Apply tracks what it last applied (stored as an annotation) and can perform three-way merges. In production always use `kubectl apply -f` with version-controlled YAML files, because it's idempotent and auditable. Use `kubectl create` only for quick one-off tasks or to generate YAML templates with `--dry-run=client -o yaml`.

**Q: How do you view logs of a crashed container?**
Answer: Use `kubectl logs <pod> --previous` (or `-p`) to view logs from the last terminated container instance. Also `kubectl describe pod <name>` shows the container's last exit code, reason, and any OOM events. If the pod keeps restarting rapidly, use `kubectl logs <pod> --previous --tail=50` to get the last 50 lines before the crash. For crash-looping pods, you can also inject a `sleep` command temporarily to keep the container alive for exec debugging.

**Q: What is the difference between imperative and declarative Kubernetes management?**
Answer: Imperative means issuing direct action commands: `kubectl run`, `kubectl scale`, `kubectl set image`. These are quick but not reproducible or auditable. Declarative means writing YAML manifests that describe the desired state and applying them with `kubectl apply -f`. This approach is idempotent (safe to run multiple times), version-controllable in Git, enables GitOps workflows, and makes changes auditable through diffs. Production environments should always use declarative management.

**Q: How would you debug a Pod that is stuck in CrashLoopBackOff?**
Answer: First, `kubectl describe pod <name>` — read the Events section and the container's Last State (exit code, reason). Exit code 137 = OOMKilled (out of memory); 1 = application error; 139 = segfault. Second, `kubectl logs <pod> --previous` to see the application logs from before the crash. Third, if the container exits too fast to exec in, temporarily override the command in the spec with `command: ["sleep", "3600"]` to keep it alive, exec in and investigate. Also check: correct image? correct environment variables? ConfigMap or Secret mounted correctly?

**Q: What is a Kubernetes namespace and when should you use multiple namespaces?**
Answer: A namespace is a virtual partition within a Kubernetes cluster that provides scope for names and resource isolation. Resources in one namespace don't conflict with same-named resources in another. Use multiple namespaces to separate environments (dev/staging/prod) on the same cluster, isolate teams, or apply different RBAC policies, resource quotas, or NetworkPolicies per namespace. Avoid namespaces for small teams or simple projects where a single default namespace is sufficient — premature namespace proliferation adds operational overhead without benefit.
