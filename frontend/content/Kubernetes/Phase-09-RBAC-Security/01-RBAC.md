# RBAC — Complete Guide

## Table of Contents
1. [What Is RBAC](#1-what-is-rbac)
2. [The RBAC Model — Subjects, Resources, Verbs](#2-the-rbac-model--subjects-resources-verbs)
3. [Role vs ClusterRole](#3-role-vs-clusterrole)
4. [RoleBinding vs ClusterRoleBinding](#4-rolebinding-vs-clusterrolebinding)
5. [Writing Role YAML](#5-writing-role-yaml)
6. [Writing ClusterRole YAML](#6-writing-clusterrole-yaml)
7. [Checking Permissions with kubectl auth can-i](#7-checking-permissions-with-kubectl-auth-can-i)
8. [Aggregated ClusterRoles](#8-aggregated-clusterroles)
9. [Least Privilege Principle](#9-least-privilege-principle)
10. [Hands-On Exercises](#10-hands-on-exercises)
11. [Interview Q&A](#11-interview-qa)

---

## 1. What Is RBAC

RBAC (Role-Based Access Control) is the authorization mechanism Kubernetes uses to control who can perform which actions on which resources. It has been enabled by default since Kubernetes 1.8. Every request to the Kubernetes API server — whether from a human user running `kubectl`, a controller reconciling state, or a Pod calling the API — must pass through the RBAC authorization layer before it is allowed to proceed.

```
  Every API request goes through:
  ┌─────────────────────────────────────────────────────────────┐
  │  kubectl apply / pod calling API / controller reconciling   │
  │                        │                                    │
  │                        ▼                                    │
  │              Authentication (who are you?)                  │
  │                        │                                    │
  │                        ▼                                    │
  │              Authorization — RBAC (can you do this?)        │
  │                        │                                    │
  │                        ▼                                    │
  │              Admission Control (is it valid/allowed?)       │
  │                        │                                    │
  │                        ▼                                    │
  │              etcd / resource is created/modified            │
  └─────────────────────────────────────────────────────────────┘
```

Authentication answers "who are you?" — it verifies identity via certificates, OIDC tokens, bearer tokens, or webhook. Authorization (RBAC) answers "are you allowed to do this?" — it evaluates the request against the RBAC policies in place. Admission control then validates or mutates the request (e.g., checking resource quotas, enforcing Pod Security Standards).

RBAC is purely additive — there are no deny rules. If no policy explicitly allows an action, it is denied. This default-deny posture makes RBAC safe to work with: a misconfiguration leads to a permission error, not an unintended grant.

RBAC is configured using four API objects: `Role`, `ClusterRole`, `RoleBinding`, and `ClusterRoleBinding`. All live under the `rbac.authorization.k8s.io/v1` API group.

---

## 2. The RBAC Model — Subjects, Resources, Verbs

Every RBAC policy answers three questions: **who** (subject), **what** (resource), and **how** (verb). These three components form the complete RBAC model.

```
  Subject (User/Group/ServiceAccount)
          │
          │   bound by
          ▼
  RoleBinding ──────────────▶ Role ──────────────▶ Resources + Verbs
                                                   (namespaced)
  ClusterRoleBinding ───────▶ ClusterRole ────────▶ Resources + Verbs
                                                   (cluster-wide)
```

### Subjects

Subjects are the entities that permissions are granted to. Kubernetes supports three types:

- **User** — a human identity, authenticated externally (via client certificates, OIDC, or webhook). Kubernetes does not manage user accounts itself; it trusts what the authenticator says.
- **Group** — a set of users sharing a logical identity. Also externally managed. Common system groups include `system:masters` (cluster admin) and `system:authenticated` (any authenticated user).
- **ServiceAccount** — a Kubernetes-native identity for workloads running inside the cluster. Unlike Users, ServiceAccounts are Kubernetes objects, live in a specific namespace, and get an automatically mounted token that Pods can use to call the API.

### Resources

Resources are the Kubernetes API objects the rule applies to — `pods`, `deployments`, `services`, `secrets`, `configmaps`, `nodes`, `namespaces`, `persistentvolumes`, and so on. Resources can also include **subresources**, which are sub-paths of a resource such as `pods/log`, `pods/exec`, and `pods/status`. These are specified with a slash in the rules.

### Verbs

Verbs map directly to HTTP methods on the Kubernetes REST API:

| Verb               | HTTP Method | Description                              |
|--------------------|-------------|------------------------------------------|
| `get`              | GET         | Read a single named resource             |
| `list`             | GET         | Read a collection of resources           |
| `watch`            | GET         | Stream events for a resource             |
| `create`           | POST        | Create a new resource                    |
| `update`           | PUT         | Replace an existing resource fully       |
| `patch`            | PATCH       | Partially update a resource              |
| `delete`           | DELETE      | Delete a single resource                 |
| `deletecollection` | DELETE      | Delete a collection of resources         |
| `*`                | (all)       | Wildcard — all verbs                     |

Read-only roles typically grant `get`, `list`, and `watch`. Operator roles add `create`, `update`, and `patch`. Full-control roles add `delete` and `deletecollection`.

---

## 3. Role vs ClusterRole

The key distinction is **scope**.

**Role** is namespaced. It can only grant access to resources within the namespace where it is created. You cannot use a Role to grant access to cluster-scoped resources like `nodes` or `persistentvolumes`, and you cannot use it to grant access across multiple namespaces.

**ClusterRole** is cluster-scoped. It can:
- Grant access to cluster-wide resources (nodes, namespaces, persistentvolumes, storageclasses)
- Grant access to non-resource URLs like `/healthz` and `/metrics`
- Be reused across multiple namespaces by binding it with namespace-scoped RoleBindings (a common pattern)

```
  Namespace: production
  ┌──────────────────────────────────────────────────────┐
  │  Role: pod-reader                                    │
  │    rules: get/list/watch pods                        │
  │                                                      │
  │  → Grants access ONLY within "production" namespace  │
  └──────────────────────────────────────────────────────┘

  Cluster-wide
  ┌──────────────────────────────────────────────────────┐
  │  ClusterRole: node-reader                            │
  │    rules: get/list/watch nodes                       │
  │                                                      │
  │  → Grants access to nodes across the entire cluster  │
  │  → Can also be bound per-namespace via RoleBinding   │
  └──────────────────────────────────────────────────────┘
```

**When to use which:**
- Use a **Role** for workload-specific or team-specific permissions that are scoped to one namespace.
- Use a **ClusterRole** for cluster-wide resources, or when you want to define a reusable role template that multiple namespaces bind to — this avoids duplicating the same Role definition in every namespace.

---

## 4. RoleBinding vs ClusterRoleBinding

The binding objects connect subjects to roles.

**RoleBinding** grants the permissions defined in a Role (or ClusterRole) within a specific namespace. The subjects named in the binding can only act on resources in that one namespace — even if the referenced role is a ClusterRole.

**ClusterRoleBinding** grants permissions cluster-wide. The subjects can act on the referenced ClusterRole's resources across all namespaces and on cluster-scoped resources.

```
  Pattern 1: Namespace-scoped access
  ──────────────────────────────────
  RoleBinding (namespace: production)
    subject: alice
    roleRef: Role/pod-reader (namespace: production)
  → alice can read pods in "production" only

  Pattern 2: Reuse ClusterRole across namespaces
  ───────────────────────────────────────────────
  RoleBinding (namespace: staging)
    subject: alice
    roleRef: ClusterRole/pod-reader
  → alice can read pods in "staging" only (namespace-scoped by the binding)

  Pattern 3: Cluster-wide access
  ───────────────────────────────
  ClusterRoleBinding
    subject: ops-team (Group)
    roleRef: ClusterRole/cluster-reader
  → ops-team can read resources across ALL namespaces + cluster resources
```

A critical rule: a RoleBinding and the Role it references must be in the same namespace. You cannot create a RoleBinding in namespace A that references a Role in namespace B. ClusterRoles have no namespace, so they can be referenced from any RoleBinding regardless of namespace.

---

## 5. Writing Role YAML

### Basic Pod Reader Role

This Role grants read-only access to pods and their logs within the `production` namespace.

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
  namespace: production
rules:
  - apiGroups: [""]          # "" = core API group (pods, services, secrets, etc.)
    resources: ["pods", "pods/log"]
    verbs: ["get", "list", "watch"]
```

The `apiGroups` field identifies which API group the resources belong to. The core group (pods, services, configmaps, secrets, nodes, namespaces) uses an empty string `""`. Named groups like `apps` cover deployments and statefulsets, `batch` covers jobs and cronjobs, and `networking.k8s.io` covers ingresses.

### Multiple Rule Sets

A single Role can have multiple rule sets covering different API groups:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: app-operator
  namespace: production
rules:
  - apiGroups: [""]
    resources: ["pods", "pods/log", "services", "configmaps"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["apps"]
    resources: ["deployments", "replicasets"]
    verbs: ["get", "list", "watch", "update", "patch"]
  - apiGroups: [""]
    resources: ["events"]
    verbs: ["get", "list", "watch"]
```

### RoleBinding

Bind the `pod-reader` Role to a user and a ServiceAccount:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: read-pods-binding
  namespace: production
subjects:
  - kind: User
    name: alice
    apiGroup: rbac.authorization.k8s.io
  - kind: ServiceAccount
    name: monitoring-sa
    namespace: monitoring
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

Note that a RoleBinding can reference a ServiceAccount from a different namespace (e.g., `monitoring-sa` in the `monitoring` namespace) — but the permissions granted are still scoped to the RoleBinding's namespace (`production`).

### Apply and Verify

```bash
# Apply the Role and RoleBinding
kubectl apply -f pod-reader-role.yaml
kubectl apply -f read-pods-binding.yaml

# Describe the role to see its rules
kubectl describe role pod-reader -n production

# Describe the binding to see what is bound
kubectl describe rolebinding read-pods-binding -n production

# List all roles in a namespace
kubectl get roles -n production

# List all rolebindings in a namespace
kubectl get rolebindings -n production
```

---

## 6. Writing ClusterRole YAML

### Cluster-Wide Read-Only Operator

A ClusterRole suitable for a monitoring or read-only ops user:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: cluster-reader
rules:
  - apiGroups: [""]
    resources: ["pods", "nodes", "services", "namespaces", "persistentvolumes",
                "endpoints", "events", "configmaps"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["apps"]
    resources: ["deployments", "replicasets", "statefulsets", "daemonsets"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["batch"]
    resources: ["jobs", "cronjobs"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["networking.k8s.io"]
    resources: ["ingresses", "networkpolicies"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["storage.k8s.io"]
    resources: ["storageclasses", "persistentvolumeclaims"]
    verbs: ["get", "list", "watch"]
```

### ClusterRoleBinding

Bind the `cluster-reader` ClusterRole to an ops group cluster-wide:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: cluster-reader-binding
subjects:
  - kind: Group
    name: cluster-admins
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: ClusterRole
  name: cluster-reader
  apiGroup: rbac.authorization.k8s.io
```

### ClusterRole Bound per Namespace (Reuse Pattern)

Bind the same ClusterRole to different teams in different namespaces using RoleBindings:

```yaml
# Team A gets cluster-reader permissions in "team-a" namespace only
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: team-a-reader
  namespace: team-a
subjects:
  - kind: Group
    name: team-a-developers
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: ClusterRole
  name: cluster-reader
  apiGroup: rbac.authorization.k8s.io
---
# Team B gets the same permissions in "team-b" namespace only
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: team-b-reader
  namespace: team-b
subjects:
  - kind: Group
    name: team-b-developers
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: ClusterRole
  name: cluster-reader
  apiGroup: rbac.authorization.k8s.io
```

This avoids maintaining duplicate Role objects in every namespace — define the ClusterRole once, bind it selectively.

### List and Inspect ClusterRoles

```bash
# List all ClusterRoles (includes built-in ones)
kubectl get clusterroles

# List only custom ClusterRoles (exclude system: prefix)
kubectl get clusterroles | grep -v system:

# Describe a ClusterRole to see its rules
kubectl describe clusterrole cluster-reader

# Get a ClusterRole as YAML for inspection
kubectl get clusterrole cluster-reader -o yaml
```

---

## 7. Checking Permissions with kubectl auth can-i

`kubectl auth can-i` is the built-in tool for auditing RBAC permissions. It tells you whether a subject is allowed to perform a specific action.

```bash
# Can the current user create pods in the default namespace?
kubectl auth can-i create pods

# Can the current user delete deployments in production?
kubectl auth can-i delete deployments --namespace production

# Can user alice list secrets in the production namespace?
kubectl auth can-i list secrets --namespace production --as alice

# Can user bob create namespaces (cluster-scoped resource)?
kubectl auth can-i create namespaces --as bob

# Can ServiceAccount monitoring-sa in the monitoring namespace get nodes?
kubectl auth can-i get nodes \
  --as system:serviceaccount:monitoring:monitoring-sa

# Can ServiceAccount default in namespace app-ns create deployments?
kubectl auth can-i create deployments \
  --as system:serviceaccount:app-ns:default \
  --namespace app-ns

# List ALL permissions the current user has in the default namespace
kubectl auth can-i --list

# List ALL permissions a specific user has in a specific namespace
kubectl auth can-i --list --namespace production --as alice

# List ALL permissions a ServiceAccount has cluster-wide
kubectl auth can-i --list --as system:serviceaccount:monitoring:monitoring-sa
```

```
  Example output of kubectl auth can-i --list:
  ┌─────────────────────────────────────────────────────────────┐
  │  Resources                Non-Resource URLs  Verbs          │
  │  ──────────                ────────────────  ─────          │
  │  *.*                       []                [*]            │
  │  pods                      []                [get list]     │
  │  deployments.apps          []                [get list]     │
  │  secrets                   []                []             │
  └─────────────────────────────────────────────────────────────┘
  Empty verbs on secrets = no access to secrets
```

### Impersonation

The `--as` flag triggers API server impersonation — it makes the request as if the named subject were calling it. This requires the `impersonate` verb on the current user's permissions (cluster-admin or a role granting `users` impersonation).

```bash
# Impersonate a group
kubectl auth can-i list pods --as-group=system:masters --as=dummy-user

# Impersonate a ServiceAccount's group as well
kubectl auth can-i get secrets \
  --as system:serviceaccount:production:app-sa \
  --namespace production
```

---

## 8. Aggregated ClusterRoles

Kubernetes ships with a built-in ClusterRole aggregation mechanism. The default ClusterRoles `view`, `edit`, and `admin` are aggregated roles — they automatically incorporate rules from any ClusterRole that carries a matching aggregation label. This allows you to extend built-in roles without modifying them.

```
  Aggregation flow:
  ┌──────────────────────────────────────────────────────┐
  │  ClusterRole: view                                   │
  │    aggregationRule:                                  │
  │      clusterRoleSelectors:                           │
  │        - matchLabels:                                │
  │            rbac.authorization.k8s.io/               │
  │            aggregate-to-view: "true"                 │
  │                                                      │
  │  Kubernetes controller watches for ClusterRoles      │
  │  with that label and merges their rules into view    │
  └──────────────────────────────────────────────────────┘
          │
          ▼ auto-merged
  ┌──────────────────────────────────────────────────────┐
  │  ClusterRole: custom-crd-viewer                      │
  │    labels:                                           │
  │      aggregate-to-view: "true"                       │
  │    rules: get/list/watch myresources.mycompany.io    │
  └──────────────────────────────────────────────────────┘
```

### Extending the view ClusterRole

Any user with the `view` ClusterRole (or a RoleBinding to `view`) automatically gains access to your custom resources:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: custom-crd-viewer
  labels:
    rbac.authorization.k8s.io/aggregate-to-view: "true"  # auto-merged into 'view'
rules:
  - apiGroups: ["mycompany.io"]
    resources: ["myresources", "myresources/status"]
    verbs: ["get", "list", "watch"]
```

### Extending edit and admin

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: custom-crd-editor
  labels:
    rbac.authorization.k8s.io/aggregate-to-edit: "true"   # merged into 'edit'
    rbac.authorization.k8s.io/aggregate-to-admin: "true"  # merged into 'admin'
rules:
  - apiGroups: ["mycompany.io"]
    resources: ["myresources"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
```

### Creating Your Own Aggregated ClusterRole

You can also create custom aggregated ClusterRoles that pull in other sub-roles:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: monitoring-full-access
aggregationRule:
  clusterRoleSelectors:
    - matchLabels:
        app.kubernetes.io/component: monitoring
rules: []   # rules are populated automatically by the aggregation controller
```

### Verify Aggregation Worked

```bash
# Check that view now includes your custom rules
kubectl get clusterrole view -o yaml | grep myresources

# Or describe it
kubectl describe clusterrole view
```

---

## 9. Least Privilege Principle

The principle of least privilege states that every subject should have only the minimum permissions required to perform its function — nothing more. In Kubernetes RBAC this means:

**Start with no permissions and add only what is required.** Never begin by granting broad permissions and then trying to narrow them down. Default deny is the correct starting posture.

**Prefer Roles over ClusterRoles.** A namespaced Role that covers exactly the resources a workload needs is safer than a ClusterRole that may inadvertently grant access to cluster-wide resources.

**Avoid wildcards.** Using `"*"` for resources or verbs is almost never appropriate outside of cluster-admin. Be explicit.

**Never use cluster-admin for workloads.** The `cluster-admin` ClusterRole grants unrestricted access to everything. It should be used only for cluster bootstrapping. Compromise of a workload with cluster-admin = full cluster compromise.

**Audit regularly.** Permissions tend to accumulate over time. Review and remove unused bindings.

### Built-In ClusterRoles Reference

Kubernetes ships with four commonly used built-in ClusterRoles:

```
  ┌──────────────────┬─────────────────────────────────────────────────────┐
  │ ClusterRole      │ Description                                         │
  ├──────────────────┼─────────────────────────────────────────────────────┤
  │ cluster-admin    │ Full access to all resources across the cluster      │
  │ admin            │ Full read/write in a namespace (no roles management) │
  │ edit             │ Read/write most resources in a namespace             │
  │ view             │ Read-only access to most resources in a namespace    │
  └──────────────────┴─────────────────────────────────────────────────────┘

  cluster-admin > admin > edit > view  (in terms of permissions)

  edit vs admin:
    admin   can also manage roles and rolebindings in the namespace
    edit    cannot manage roles or rolebindings (safer for developers)
```

### Practical Patterns

```bash
# Give a developer read/write access in their team namespace
kubectl create rolebinding dev-edit \
  --clusterrole=edit \
  --user=alice \
  --namespace=team-a

# Give a CI/CD ServiceAccount the ability to deploy in a namespace
kubectl create rolebinding cicd-deploy \
  --clusterrole=edit \
  --serviceaccount=cicd:deploy-sa \
  --namespace=production

# Give a monitoring tool read-only access cluster-wide
kubectl create clusterrolebinding monitoring-view \
  --clusterrole=view \
  --serviceaccount=monitoring:prometheus-sa

# Audit permissions of a ServiceAccount
kubectl auth can-i --list \
  --as system:serviceaccount:production:app-sa \
  --namespace production
```

---

## 10. Hands-On Exercises

**Exercise 1:** Create a namespace called `team-a`. Create a Role named `pod-manager` in that namespace granting `get`, `list`, `watch`, `create`, and `delete` on `pods`. Create a ServiceAccount `dev-sa` in `team-a`. Bind the role to the ServiceAccount with a RoleBinding named `pod-manager-binding`. Verify with `kubectl auth can-i create pods --namespace team-a --as system:serviceaccount:team-a:dev-sa` (expect `yes`). Also verify that the ServiceAccount cannot access secrets: `kubectl auth can-i get secrets --namespace team-a --as system:serviceaccount:team-a:dev-sa` (expect `no`).

**Exercise 2:** Create a ClusterRole named `node-reader` that allows `get`, `list`, and `watch` on `nodes`. Bind it to a user called `ops-user` using a ClusterRoleBinding named `node-reader-binding`. Verify with `kubectl auth can-i list nodes --as ops-user` (expect `yes`). Then verify the user cannot delete nodes: `kubectl auth can-i delete nodes --as ops-user` (expect `no`). Finally verify the user cannot create pods: `kubectl auth can-i create pods --as ops-user` (expect `no`).

**Exercise 3:** Use `kubectl auth can-i --list --namespace default` to list all permissions your current context has in the default namespace. Identify any overly broad permissions — for example, `*` verbs on `*` resources indicates cluster-admin access. Compare against the principle of least privilege and note which permissions would be unnecessary for a typical application workload. If your cluster is local (e.g., kind or minikube), you will likely see broad access; document what a production hardened role would look like instead.

**Exercise 4:** Create a Role that grants `get` and `list` on `secrets` in the `default` namespace. Bind it to a ServiceAccount named `secret-reader-sa`. Deploy a Pod that uses that ServiceAccount. Exec into the Pod and use the automatically mounted service account token to call the Kubernetes API directly:

```bash
curl -H "Authorization: Bearer $(cat /var/run/secrets/kubernetes.io/serviceaccount/token)" \
  https://kubernetes.default.svc/api/v1/namespaces/default/secrets \
  --cacert /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
```

Confirm you get a valid JSON response listing secrets. Then try listing pods (which the ServiceAccount has no permission for) and confirm you get a `403 Forbidden` response. This demonstrates how RBAC controls workload-level API access through the mounted token.

**Exercise 5:** Explore aggregated ClusterRoles. Create a custom ClusterRole with label `rbac.authorization.k8s.io/aggregate-to-view: "true"` that grants `get`, `list`, and `watch` on a custom resource group (use `mycompany.io` as the API group and `widgets` as the resource — the CRD does not need to exist for the RBAC rule to be created). Apply it with `kubectl apply`. Then verify the built-in `view` ClusterRole has been automatically updated: `kubectl get clusterrole view -o yaml` — look for `mycompany.io` in the rules section. This confirms the aggregation controller merged your rules into the built-in role without requiring you to modify it.

---

## 11. Interview Q&A

**Q: What is the difference between a Role and a ClusterRole in Kubernetes?**
Answer: A Role is namespaced — it can only grant access to resources within the namespace where it is created. A ClusterRole is cluster-scoped and can grant access to cluster-wide resources (like nodes, persistentvolumes, and namespaces) or be reused across multiple namespaces. A key pattern is binding a ClusterRole with a namespaced RoleBinding — this restricts the ClusterRole's permissions to a single namespace while reusing the role definition across multiple namespaces, avoiding the need to duplicate the same Role in every namespace.

**Q: How does a RoleBinding differ from a ClusterRoleBinding?**
Answer: A RoleBinding grants permissions within a specific namespace, binding a Role or ClusterRole to subjects in that namespace only. A ClusterRoleBinding grants permissions cluster-wide — the subject can act on the referenced ClusterRole's resources across all namespaces. Importantly, you cannot use a RoleBinding to grant namespace-scoped access to a Role that lives in a different namespace; the Role and RoleBinding must be in the same namespace. However, a RoleBinding can reference a ClusterRole and still be namespace-scoped — this is the standard pattern for reusing role definitions.

**Q: What are RBAC subjects and what types does Kubernetes support?**
Answer: Subjects are the entities that RBAC permissions are granted to. Kubernetes supports three types: User (a human user, authenticated via certificates, OIDC, or webhook — not managed by Kubernetes itself), Group (a set of users, also external to Kubernetes — common groups include `system:masters` and `system:authenticated`), and ServiceAccount (a Kubernetes-managed identity for workloads running inside the cluster, created in a specific namespace). ServiceAccounts are the most common subjects for workload-level RBAC because they are native Kubernetes objects with automatically managed tokens that Pods can use to call the API.

**Q: What verbs are available in Kubernetes RBAC and which are most commonly restricted?**
Answer: RBAC verbs map to HTTP methods on the Kubernetes API: `get` (single resource read), `list` (collection read), `watch` (streaming events), `create`, `update` (full replace), `patch` (partial update), `delete`, and `deletecollection`. The wildcard `*` grants all verbs. The most commonly restricted are `create`, `update`, `patch`, and `delete` — read-only roles use only `get`, `list`, and `watch`. For subresources like `pods/exec` and `pods/log`, you specify them separately in the rules using the subresource name with a slash. The `pods/exec` verb in particular should be tightly controlled since it gives shell access to running containers.

**Q: How do you audit what permissions a ServiceAccount has?**
Answer: Use `kubectl auth can-i --list --as system:serviceaccount:<namespace>/<name>` to list all permissions the ServiceAccount has. For a comprehensive audit, use community tools like `kubectl-who-can` (which finds all subjects that can perform a specific action — useful for answering "who can delete secrets?") or `rakkess` (which shows an access matrix for multiple verbs at once). You can also review all RoleBindings and ClusterRoleBindings that reference the ServiceAccount directly: `kubectl get rolebindings,clusterrolebindings -A -o json | jq '.items[] | select(.subjects[]?.name=="<sa-name>")'`. For ongoing governance, tools like Polaris and Fairwinds Insights can flag overly permissive ServiceAccounts automatically.
