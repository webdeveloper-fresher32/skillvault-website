# Deploying to Kubernetes

Once an image is built and pushed (Phase 10, Lesson 1), something has to tell the running system to actually use it. For a Kubernetes-based deployment, that "something" is a workflow step that authenticates to the target cluster and then updates a Deployment to point at the new image — either by applying an updated manifest, running `kubectl set image`, or invoking `helm upgrade` for a Helm-managed release. This lesson stays deliberately cloud-agnostic: the same pattern applies whether the cluster runs on a cloud provider or is self-hosted, because the authentication mechanism is the one part that's provider-specific and everything after it (`kubectl`, rollout verification) is identical.

## 1. Authenticating to a Cluster

The specific mechanism depends on where the cluster lives: a cloud provider's own CLI/action (installed and configured with cloud credentials) can fetch cluster access dynamically, or a pre-built `kubeconfig` file can be stored as a secret and written to disk on the runner before any `kubectl` command runs. Either way, this step must complete before any `kubectl`/`helm` command that follows, or those commands have nothing to authenticate against.

```yaml
- name: Configure cluster access
  run: |
    mkdir -p "$HOME/.kube"
    echo "${{ secrets.KUBE_CONFIG }}" | base64 -d > "$HOME/.kube/config"
```

## 2. Why Deploy Credentials Should Be Short-Lived

A `kubeconfig` embedding a long-lived, cluster-admin-equivalent credential is a standing risk: if that secret ever leaks, whoever has it can do anything to the entire cluster, not just redeploy this one application. A deploy-only service account or role, scoped to just the namespace and verbs (`get`, `update` on Deployments, say) this workflow actually needs, shrinks what a leaked credential can do. Where the cluster and CI platform support it, short-lived tokens obtained via OIDC federation avoid storing any long-lived cluster credential as a secret at all — Phase 11's OIDC lesson covers this pattern in depth.

| Credential type | Blast radius if leaked | Lifetime |
|---|---|---|
| Cluster-admin `kubeconfig` | Anything in the entire cluster | Until manually rotated/revoked |
| Deploy-only, namespace-scoped role | Only what the role's verbs allow (e.g. update Deployments in one namespace) | Until manually rotated/revoked |
| OIDC-federated short-lived token | Same as the scoped role, but window is much narrower | Minted per workflow run, expires shortly after |

## 3. Applying a Manifest / `kubectl set image`

`kubectl set image deployment/<name> <container>=<new-image>:<tag>` is the narrowest option — it patches exactly one field on one Deployment. Applying an updated manifest (`kubectl apply -f deployment.yaml`) works when more than the image tag changed. `helm upgrade` is the equivalent operation for a Helm-managed release, typically passing the new tag via `--set image.tag=<tag>` or an updated values file.

```yaml
- name: Update the Deployment's image
  run: |
    kubectl set image deployment/my-app \
      my-app=${{ env.IMAGE_NAME }}:${{ needs.build-and-push.outputs.image-tag }}
```

## 4. Verifying Rollout Success

Kubernetes accepts the change and begins a rolling update asynchronously from the CI workflow's point of view: `kubectl set image` returns as soon as the Deployment object is updated, well before the new pods are confirmed healthy. The workflow must explicitly wait for and verify the rollout with `kubectl rollout status`, which blocks until the rollout either completes successfully or times out/fails.

```yaml
- name: Wait for rollout to complete
  run: kubectl rollout status deployment/my-app --timeout=120s
```

A failed rollout should fail the job — `kubectl rollout status` exits non-zero if the rollout doesn't complete within its timeout, which, same as Phase 9's test-command exit codes, is what makes the workflow's own pass/fail status trustworthy rather than optimistic. Skipping this step is what lets a workflow report green while the actual pods behind it are crash-looping.

## 5. Full Example: Build, Push, and Deploy

A cloud-agnostic workflow that builds an image, pushes it, and then updates a Kubernetes Deployment's image tag via `kubectl set image`, waiting for the rollout to complete:

```yaml
name: Build, Push, and Deploy to Kubernetes

on:
  push:
    branches:
      - main

env:
  IMAGE_NAME: ghcr.io/${{ github.repository }}

permissions:
  contents: read
  packages: write

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    outputs:
      image-tag: ${{ github.sha }}
    steps:
      - name: Check out code
        uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push image
        uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ${{ env.IMAGE_NAME }}:${{ github.sha }}

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    steps:
      - name: Configure cluster access
        run: |
          mkdir -p "$HOME/.kube"
          echo "${{ secrets.KUBE_CONFIG }}" | base64 -d > "$HOME/.kube/config"
        # KUBE_CONFIG holds a deploy-only, namespace-scoped credential —
        # never a cluster-admin kubeconfig. See Section 2 and Phase 11's OIDC lesson.

      - name: Update the Deployment's image
        run: |
          kubectl set image deployment/my-app \
            my-app=${{ env.IMAGE_NAME }}:${{ needs.build-and-push.outputs.image-tag }}

      - name: Wait for rollout to complete
        run: kubectl rollout status deployment/my-app --timeout=120s
```

This YAML was parsed with `python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())"` and loads cleanly as a single well-formed document.

`build-and-push` builds and pushes the image tagged with the commit SHA, exposing that SHA as a job output so `deploy` can reference the exact image it just pushed rather than guessing at a tag. `deploy` needs `build-and-push` to have completed first, then writes a `kubeconfig` from a secret to authenticate `kubectl` — deliberately generic here, since the actual mechanism (a cloud CLI action vs. a raw `kubeconfig` secret) depends on where the cluster is hosted. `kubectl set image` patches only the `my-app` container's image reference on the `my-app` Deployment. Critically, the workflow doesn't stop there: `kubectl rollout status --timeout=120s` blocks until Kubernetes confirms the new pods are actually up and ready, and exits non-zero (failing the job) if the rollout stalls or the new pods crash-loop within that window — without this last step, the job would report success the instant `kubectl set image` was accepted, regardless of what happened afterward.

## Comparison

| Approach | Scope of change | When to use |
|---|---|---|
| `kubectl set image` | One container's image on one Deployment | Only the image tag changed |
| `kubectl apply -f manifest.yaml` | Any field in the manifest | Replicas, resource limits, env vars, or other fields also changed |
| `helm upgrade` | Templated manifest from a chart + values | Deployment is Helm-managed |
| `kubectl set image` alone (no rollout check) | Confirms Kubernetes *accepted* the desired-state change | Never sufficient on its own |
| `kubectl set image` + `kubectl rollout status` | Confirms the *actual* state converged to the desired one | Always — this is what "deployment succeeded" should mean |
| Long-lived cluster-admin `kubeconfig` | Anything in the entire cluster | Avoid — use only if no scoped alternative exists |
| Scoped, deploy-only credential | Only what the deploy needs (e.g. update Deployments in one namespace) | Preferred default |
| Short-lived OIDC-issued token (Phase 11) | Same as scoped credential, minted per run | Preferred where cluster/CI platform support it |

## Common Mistakes

- **Storing a full, long-lived `kubeconfig` with cluster-admin rights as a plain repository secret**, when a deploy-only, namespace-scoped service account or role would perform the exact same `kubectl set image`/`helm upgrade` operation with far less at stake if the secret ever leaks.
- **Treating `kubectl set image` (or `helm upgrade`) returning success as proof the deployment succeeded**, without a following `kubectl rollout status` (or `helm upgrade --wait`) step — the command accepting the change and the new pods actually becoming healthy are two different events, and only the second one is what "deployment succeeded" should mean.
- **Letting the job report green while pods behind it are crash-looping**, which is the direct consequence of the mistake above: without a rollout-status check (and without that check's exit code actually failing the job), CI has no way to catch a bad image or misconfiguration that only manifests once pods actually start.
- **Granting the CI credential permissions far broader than the operation it performs** — a role that can delete namespaces, modify RBAC, or touch unrelated workloads, when the workflow only ever calls `kubectl set image` on one Deployment, needlessly widens what a compromised pipeline or leaked secret can do.
- **Hardcoding cluster endpoints or credentials per-environment directly in the workflow file** instead of sourcing them from Environment-scoped secrets (Phase 10, Lesson 3) — risking a staging deploy accidentally targeting production, or vice versa, if the wrong value is pasted into the wrong job.

## Hands-On Exercises

1. Save the full example workflow from Section 5 as `.github/workflows/deploy.yml` and validate it with `actionlint .github/workflows/deploy.yml`, confirming no syntax errors.
2. Run `python3 -c "import yaml; print(yaml.safe_load(open('.github/workflows/deploy.yml')))"` to confirm the file parses as valid YAML.
3. Against a test cluster (e.g. a local `kind` or `minikube` cluster), run `kubectl set image deployment/my-app my-app=<bad-image-tag>` by hand, immediately check the exit code with `echo $?` (it will be 0 — the patch was accepted), then run `kubectl rollout status deployment/my-app --timeout=30s` and observe it exit non-zero once the bad image fails to start — demonstrating the gap between "accepted" and "healthy."
4. Create a Kubernetes `Role` scoped to only `get`/`update` on `deployments` in one namespace, bind it to a `ServiceAccount`, generate a `kubeconfig` for that account, and confirm with `kubectl auth can-i delete namespaces --as=system:serviceaccount:<ns>:<sa>` that it returns `no`.
5. In the deploy job, remove the `kubectl rollout status` step, intentionally deploy an image that crash-loops, and confirm via `gh run view` that the job still reports success — then restore the step and confirm the same bad deploy now fails the job.

## Interview Q&A

**Q: Your team's Kubernetes deploy step reports success on every run, but pods keep crash-looping right after. What's likely missing from the workflow?**
A: A missing (or ignored) `kubectl rollout status` check. `kubectl set image` only confirms Kubernetes accepted the desired-state change, not that the new pods actually became healthy, so a workflow that stops at the `set image` command has no way to detect a bad rollout.

**Q: Why prefer a scoped, deploy-only Kubernetes credential over a full `kubeconfig` with cluster-admin rights, if both can perform the deploy?**
A: Blast-radius reduction. The scoped credential can only do what the deploy actually needs, so a leaked secret limits an attacker to redeploying one application rather than compromising the entire cluster. Shorter-lived, OIDC-issued credentials (Phase 11) narrow that window even further.

**Q: When would you use `kubectl apply -f manifest.yaml` instead of `kubectl set image`?**
A: When more than the image tag changed — replicas, resource limits, environment variables, or any other manifest field. `kubectl set image` only patches one container's image reference; it can't express broader manifest changes.

**Q: Why does `deploy` in the example workflow use `needs: build-and-push` and read `needs.build-and-push.outputs.image-tag` instead of just recomputing `${{ github.sha }}` itself?**
A: To deploy exactly the image that was just pushed rather than assuming a tag — the job output is the authoritative record of what `build-and-push` actually produced, which also keeps the dependency between the two jobs explicit.
