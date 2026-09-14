# Docker Interview Q&A

50 questions covering the full Docker course, organized by topic.

---

## Fundamentals (Q1–Q10)

**Q1. What is Docker and what problem does it solve?**
Answer: Docker is an open-source platform that uses OS-level virtualization to package applications and their dependencies into lightweight, portable units called containers. Before Docker, teams suffered from "it works on my machine" problems because differences in OS, library versions, and configuration between development, staging, and production caused unpredictable failures. Docker solves this by bundling the application code, runtime, system tools, and libraries into a single image that runs identically everywhere. This dramatically simplifies onboarding, CI/CD pipelines, and multi-environment deployments.

---

**Q2. What is the difference between a Docker image and a Docker container?**
Answer: A Docker image is a read-only, layered template that contains the filesystem, dependencies, and metadata needed to run an application — it is a blueprint. A container is a running (or stopped) instance of an image; it adds a thin writable layer on top of the image's read-only layers. Multiple containers can be spawned from the same image simultaneously, each with its own writable state. Deleting a container does not delete the underlying image.

---

**Q3. How does Docker differ from a virtual machine?**
Answer: Virtual machines each include a full guest OS kernel and hardware emulation managed by a hypervisor, making them heavyweight (GBs of disk, seconds to minutes to boot). Docker containers share the host OS kernel and isolate processes using Linux namespaces and cgroups, making them lightweight (MBs, milliseconds to start). VMs offer stronger isolation because each has its own kernel; containers trade some isolation for density and speed. For most microservices workloads, container isolation is sufficient.

---

**Q4. What are Linux namespaces and cgroups, and how does Docker use them?**
Answer: Linux namespaces provide isolation for system resources — each container gets its own PID namespace (process tree), net namespace (network stack), mnt namespace (filesystem), uts namespace (hostname), and ipc namespace. Cgroups (control groups) enforce resource limits such as CPU, memory, and I/O bandwidth on a per-container basis. Docker uses these two kernel primitives together: namespaces make each container believe it is the only process on the system, and cgroups prevent any single container from monopolizing host resources.

---

**Q5. What is the Docker daemon and what role does it play?**
Answer: The Docker daemon (`dockerd`) is the long-running background service that manages all Docker objects — images, containers, networks, and volumes. It exposes a REST API that the Docker CLI (`docker`) communicates with, typically over a Unix socket at `/var/run/docker.sock`. When you run `docker run`, the CLI sends a request to the daemon, which pulls the image if needed, creates the container, and starts it. On Linux, the daemon runs as root by default, which is a security consideration to be aware of.

---

**Q6. What happens when you run `docker run -d -p 8080:80 nginx`?**
Answer: The Docker CLI sends a container-create request to the daemon. The daemon checks whether the `nginx` image exists locally; if not, it pulls it from Docker Hub. A new container is created from the image with a writable layer on top. Port 80 inside the container is mapped to port 8080 on the host via iptables NAT rules, so traffic arriving at `host:8080` is forwarded into the container. The `-d` flag detaches the container to run in the background and the CLI immediately returns the container ID.

---

**Q7. What is the Docker registry and how does it relate to Docker Hub?**
Answer: A Docker registry is a storage and distribution server for Docker images, organized into repositories (each holding tagged versions of one image). Docker Hub is the default public registry operated by Docker, Inc., hosting official images (nginx, postgres, python) and community images. Organisations can also run private registries using Docker's open-source registry image, or use managed offerings like AWS ECR, GCR, or Azure ACR. When you push or pull without a hostname prefix, Docker assumes Docker Hub.

---

**Q8. What is a Docker context and why might you use one?**
Answer: A Docker context stores connection information for a specific Docker endpoint — daemon address, TLS certificates, and orchestrator settings — under a named alias. By switching contexts with `docker context use <name>`, you can target different Docker environments (local, remote server, Kubernetes cluster) without changing environment variables or command flags. This is especially useful when managing multiple remote Docker hosts or shifting between a local dev daemon and a production server. Contexts are stored in `~/.docker/contexts/`.

---

**Q9. What is the difference between `docker stop` and `docker kill`?**
Answer: `docker stop` sends SIGTERM to the container's PID 1, giving the process a grace period (default 10 seconds) to shut down cleanly — flush buffers, close connections, release locks — before sending SIGKILL if the process has not exited. `docker kill` sends SIGKILL (or any specified signal) immediately, terminating the process with no cleanup opportunity. For production services, `docker stop` with an appropriate timeout is preferred so applications can drain gracefully.

---

**Q10. What is the purpose of the `.dockerignore` file?**
Answer: `.dockerignore` works like `.gitignore` and tells the Docker build engine which files and directories to exclude from the build context sent to the daemon. Reducing the build context speeds up builds and prevents large or sensitive files (node_modules, `.git`, `.env`, test fixtures) from being accidentally included in the image. Even if a `COPY . .` instruction is used in the Dockerfile, excluded paths will not be available inside the image. It also prevents cache invalidation caused by irrelevant file changes.

---

## Images & Dockerfiles (Q11–Q20)

**Q11. What is a Dockerfile and what are its most important instructions?**
Answer: A Dockerfile is a text file containing ordered instructions that Docker executes sequentially to build an image. The key instructions are: `FROM` (base image), `RUN` (execute a command and commit the result as a new layer), `COPY`/`ADD` (bring files into the image), `WORKDIR` (set the working directory), `ENV` (set environment variables), `EXPOSE` (document a port), `CMD` (default command when a container starts), and `ENTRYPOINT` (define the executable). Each `RUN`, `COPY`, and `ADD` creates a new immutable layer that is cached independently.

---

**Q12. What is Docker layer caching and how do you write a Dockerfile to take advantage of it?**
Answer: Each Dockerfile instruction that modifies the filesystem produces an immutable layer. Docker caches each layer keyed by the instruction and its inputs; if nothing has changed, it reuses the cached layer and skips re-execution. To maximize cache hits, place instructions that change infrequently (installing OS packages, copying dependency manifests) before instructions that change often (copying application source code). For Node.js, copy `package.json` and run `npm install` before `COPY . .` so dependency installation is cached as long as `package.json` is unchanged.

---

**Q13. What is a multi-stage build and why is it important?**
Answer: A multi-stage build uses multiple `FROM` instructions in one Dockerfile, where each stage can build on the previous or start fresh. Typically, the first stage (the "builder") installs compilers, build tools, and dev dependencies to compile the application, and the final stage copies only the compiled artifacts into a slim base image. This means the production image does not contain build tools, source code, or intermediate files, dramatically shrinking image size and reducing attack surface. For example, a Go binary can be compiled in a `golang` stage and copied into a `scratch` or `alpine` final image.

---

**Q14. What is the difference between `CMD` and `ENTRYPOINT`?**
Answer: `ENTRYPOINT` defines the executable that always runs when the container starts; it cannot be overridden by arguments passed to `docker run` (only by `--entrypoint`). `CMD` provides default arguments to `ENTRYPOINT`, or the default command if no `ENTRYPOINT` is set; it can be fully overridden by arguments to `docker run`. The common pattern is to set `ENTRYPOINT ["python", "app.py"]` and use `CMD ["--port", "8080"]` for defaults that operators can override. Both support exec form (JSON array, preferred) and shell form (string, runs via `/bin/sh -c`).

---

**Q15. What is the difference between `COPY` and `ADD`?**
Answer: `COPY` is the straightforward instruction that copies files and directories from the build context into the image, with no special behavior. `ADD` does everything `COPY` does but additionally auto-extracts `.tar` archives and can fetch files from remote URLs. The Docker best-practice recommendation is to always use `COPY` unless you specifically need the auto-extract feature, because `ADD`'s extra behaviors can lead to unexpected results and make the Dockerfile harder to reason about. Fetching from URLs with `ADD` also bypasses layer caching in some cases.

---

**Q16. What does `EXPOSE` do and why doesn't it actually publish a port?**
Answer: `EXPOSE` is purely a documentation instruction — it records in the image metadata which port the application inside the container listens on. It does not create any firewall rule or bind any port on the host. Actual port publishing requires the `-p host:container` flag at `docker run` time (or `ports:` in Compose), which configures iptables NAT rules on the host. The value of `EXPOSE` is tooling discoverability: `docker ps` shows exposed ports, `docker run -P` uses it to auto-assign host ports, and orchestrators can query it.

---

**Q17. What is a dangling image and how do you remove it?**
Answer: A dangling image is an image that has no tag and is not referenced by any container — typically created when you rebuild an image with the same tag, orphaning the old layers. They appear as `<none>:<none>` in `docker images`. They waste disk space but are otherwise harmless. Remove them with `docker image prune` (dangling only) or `docker image prune -a` (all unused images including those with tags not referenced by any container). In CI pipelines, regularly pruning dangling images prevents disk exhaustion.

---

**Q18. How do you reduce Docker image size in practice?**
Answer: The main strategies are: use a minimal base image (`alpine`, `distroless`, or `scratch`); use multi-stage builds so build tools never reach the final image; combine related `RUN` commands with `&&` and clean up caches in the same layer (`apt-get clean && rm -rf /var/lib/apt/lists/*`); use `.dockerignore` to prevent large development directories from entering the image; and avoid installing unnecessary packages or debug tools. Tools like `dive` can inspect layer contents to find what's bloating the image.

---

**Q19. What is the difference between `docker build` and `docker buildx build`?**
Answer: `docker build` uses the legacy builder (BuildKit may be enabled via `DOCKER_BUILDKIT=1`). `docker buildx build` uses BuildKit natively through pluggable builder instances and unlocks advanced features: multi-platform builds (`--platform linux/amd64,linux/arm64`), build secrets (`--secret`), SSH forwarding (`--ssh`), cache export/import (`--cache-to`, `--cache-from`), and output options (load, push, or export to filesystem). For modern workflows, especially CI/CD with cross-platform requirements, `docker buildx` is the recommended approach.

---

**Q20. What are build secrets in Docker and why should you use them?**
Answer: Build secrets (`--secret`) allow sensitive values — API keys, SSH keys, package registry tokens — to be made available to `RUN` instructions during a build without being baked into any image layer. The secret is mounted as a temporary file at `/run/secrets/<id>` only for the duration of the specific `RUN` step and is never stored in the layer or visible in `docker history`. This is critical because image layers are immutable and permanent; if you embed a secret in a `RUN` step without using the secret mount, it can be extracted from the image even if a later layer deletes it.

---

## Networking & Volumes (Q21–Q30)

**Q21. What are the Docker network drivers and when would you use each one?**
Answer: The main network drivers are: `bridge` (the default for standalone containers on a single host — provides a private internal network with DNS resolution by container name on user-defined bridges); `host` (removes network isolation, container shares the host's network stack — maximum performance, no NAT overhead); `none` (no networking — for batch jobs that do not need network access); `overlay` (multi-host networking for Swarm services, backed by VXLAN); and `macvlan` (assigns a MAC address directly on the physical network, useful for legacy applications that require Layer 2 presence).

---

**Q22. What is the difference between the default bridge network and a user-defined bridge network?**
Answer: Containers on the default `bridge` network can only communicate by IP address — Docker does not provide automatic DNS resolution between containers on the default bridge. User-defined bridge networks provide automatic DNS resolution so containers can reach each other by name, which is far more practical. User-defined networks also provide better isolation (containers on different user-defined networks cannot communicate unless explicitly connected) and allow you to connect and disconnect containers from the network at runtime without stopping them.

---

**Q23. How do containers on the same Docker Compose project communicate?**
Answer: Docker Compose automatically creates a user-defined bridge network for each project and attaches all services to it. Each service is reachable by its service name as a DNS hostname — for example, a `web` service can connect to `db:5432` where `db` is the service name. This DNS resolution is provided by Docker's embedded DNS server at `127.0.0.11`. No explicit link configuration is required; it works automatically because all services share the same project network.

---

**Q24. What is a Docker volume and what problem does it solve?**
Answer: A Docker volume is a persistent storage mechanism managed by Docker that lives outside the container's writable layer. The container's writable layer is ephemeral — it is destroyed when the container is removed — so any data written there is lost. Volumes persist independently of container lifecycle; they survive container deletion and can be shared between multiple containers. Docker volumes are stored in `/var/lib/docker/volumes/` on Linux, can be backed by remote storage drivers (NFS, cloud block storage), and are the recommended way to persist database data, user uploads, or any stateful information.

---

**Q25. What is the difference between a bind mount and a named volume?**
Answer: A bind mount maps a specific host filesystem path into the container — the host path must exist and the developer controls the exact location (`-v /host/path:/container/path`). A named volume is fully managed by Docker, stored in Docker's volume directory, and referenced by a logical name (`-v myvolume:/container/path`). Bind mounts are ideal for development (mounting source code for live reload) because you control the host path. Named volumes are preferred for production (databases, persistent data) because they are portable, can be backed by volume drivers, and Docker manages their lifecycle.

---

**Q26. How do you share data between two running containers?**
Answer: The cleanest approach is to create a named volume and mount it in both containers with `docker run -v sharedvol:/data`. Both containers read and write to the same underlying directory. For read-only sharing, add the `:ro` mount option on the consumer side. In Compose, define the volume at the top level and reference it in both services. Bind mounts to the same host path also work, but are less portable. Note that both containers writing to the same files simultaneously requires the application to handle concurrent access correctly.

---

**Q27. What are tmpfs mounts and when would you use them?**
Answer: A tmpfs mount stores data in the host's in-memory RAM rather than on disk or in a Docker-managed volume. The data is not persisted to disk and disappears when the container stops. Use cases include: storing sensitive data (session secrets, one-time tokens) that should never touch disk; caching intermediate computation results for performance; and writing high-frequency ephemeral data where disk I/O would be a bottleneck. They are created with `--tmpfs /path` or `--mount type=tmpfs,dst=/path` and are Linux-only.

---

**Q28. What is Docker DNS and how does service discovery work?**
Answer: Docker runs an embedded DNS server inside each container's network namespace, listening at `127.0.0.11`. When a container on a user-defined network performs a DNS lookup for another container or service name, the query is intercepted by this DNS server, which resolves the name to the target container's IP address. In Swarm mode, service names resolve to a Virtual IP (VIP) that load-balances across all healthy task containers. This built-in DNS-based service discovery eliminates the need for external service registries for simple workloads.

---

**Q29. How does port publishing work under the hood?**
Answer: When you publish a port with `-p 8080:80`, Docker adds iptables rules in the `DOCKER` chain to implement DNAT (Destination NAT). Packets arriving at the host on port 8080 are rewritten by iptables to be forwarded to the container's internal IP on port 80. A corresponding MASQUERADE rule handles return traffic. Docker also configures a userland proxy by default to handle edge cases. The `docker-proxy` process (or pure iptables mode with `--userland-proxy=false`) ensures traffic flows correctly from the host to the container.

---

**Q30. How do you inspect which networks a container is connected to and what IP it has?**
Answer: `docker inspect <container>` returns full JSON metadata including the `NetworkSettings.Networks` key, which lists every network the container is attached to along with its IP address, gateway, and MAC address on that network. For a quick summary, `docker inspect --format '{{json .NetworkSettings.Networks}}' <container>` extracts just the networks section. You can also run `docker network inspect <network>` and look at the `Containers` field to see all containers on that network and their assigned IPs.

---

## Docker Compose (Q31–Q35)

**Q31. What is Docker Compose and what is it used for?**
Answer: Docker Compose is a tool for defining and running multi-container Docker applications using a declarative YAML file (`docker-compose.yml` or `compose.yml`). It models the full application stack — services, networks, volumes, environment variables, health checks — in one file and brings the entire stack up or down with a single command. It is primarily designed for development and testing workflows, enabling reproducible local environments. Compose v2 is integrated into the Docker CLI as `docker compose` (no hyphen), replacing the standalone Python-based v1 tool.

---

**Q32. What is the difference between `docker compose up` and `docker compose run`?**
Answer: `docker compose up` starts all services defined in the Compose file, creates networks and volumes, and keeps them running. It is designed for launching the full application stack. `docker compose run` starts a one-off container for a specific service, running a command you specify (or the service's `command` override), and exits when done. `run` does not start dependent services by default (use `--service-ports` to publish ports). It is used for administrative tasks: running database migrations, executing tests, or dropping into a shell for debugging.

---

**Q33. How do you manage environment-specific configuration in Docker Compose?**
Answer: The recommended approach is to use a base `docker-compose.yml` for common configuration and override files (e.g., `docker-compose.override.yml` for dev, `docker-compose.prod.yml` for production) merged at runtime with `docker compose -f docker-compose.yml -f docker-compose.prod.yml up`. Sensitive values are stored in `.env` files (automatically loaded by Compose) or passed as shell environment variables, not hardcoded in the YAML. In production, secrets management tools (Docker Secrets, Vault, cloud parameter stores) replace `.env` files.

---

**Q34. What are health checks in Docker Compose and why are they important?**
Answer: A health check defines a command Docker runs periodically inside the container to determine if the application is ready to accept traffic. You configure it in the Compose file under `healthcheck:` with `test`, `interval`, `timeout`, `retries`, and `start_period`. Containers report `healthy`, `unhealthy`, or `starting` status. Other services can use `depends_on` with `condition: service_healthy` to wait for a dependency (like a database) to be fully ready before starting, preventing race conditions at startup. In Swarm mode, unhealthy tasks are automatically restarted.

---

**Q35. How does `depends_on` work and what are its limitations?**
Answer: `depends_on` controls the startup order of services — Compose will start the listed dependencies before the dependent service. With `condition: service_healthy`, it waits until the dependency passes its health check before starting the next service. The key limitation is that `depends_on` only controls container start order, not application readiness without health checks — a database container that has started but whose Postgres process is still initializing will not block a dependent service unless a health check is configured. Applications should also implement their own retry logic for connecting to dependencies.

---

## Security & Production (Q36–Q43)

**Q36. What are the main security risks of running Docker in production?**
Answer: The primary risks are: running containers as root (if a container is compromised, the attacker may have root-equivalent access on the host); mounting the Docker socket (`/var/run/docker.sock`) into a container (grants full daemon control — effectively root on the host); using unverified images from public registries that may contain malware or vulnerabilities; not scanning images for known CVEs; overly permissive Linux capabilities; running with no resource limits allowing denial-of-service; and exposing the Docker REST API over TCP without TLS.

---

**Q37. How do you run containers with a non-root user?**
Answer: In the Dockerfile, create a system user and group and switch to them: `RUN addgroup --system app && adduser --system --ingroup app app` followed by `USER app`. At runtime, override with `docker run --user 1000:1000`. In Kubernetes or Swarm, set `securityContext.runAsNonRoot: true`. Running as non-root limits the blast radius of a container escape — an attacker who breaks out of the container will have restricted host permissions. Some base images (e.g., `node:lts-alpine`) already include a non-root user (`node`) for this purpose.

---

**Q38. What are Linux capabilities and how do you apply the principle of least privilege in Docker?**
Answer: Linux capabilities break the monolithic root privilege into fine-grained permissions (e.g., `NET_BIND_SERVICE` to bind ports below 1024, `SYS_PTRACE` to trace processes, `CAP_NET_ADMIN` to configure networking). By default, Docker grants containers a subset of capabilities. The least-privilege pattern is to drop all capabilities and re-add only what the application genuinely needs: `--cap-drop ALL --cap-add NET_BIND_SERVICE`. This is applied in Compose with `cap_drop`/`cap_add` keys. Avoid `--privileged`, which grants all capabilities and full device access — treat it as a last resort.

---

**Q39. What is a read-only root filesystem and when would you use it?**
Answer: `docker run --read-only` mounts the container's root filesystem as read-only, preventing any writes to it. This hardens the container against attacks that modify binaries, inject scripts, or write malware to the filesystem. Applications that need to write (logs, temp files, PID files) should use volume mounts or tmpfs mounts for those specific paths. A read-only root filesystem is a defense-in-depth measure: even if an attacker achieves code execution, they cannot persist changes to the container's filesystem. It is a recommended production hardening step for stateless services.

---

**Q40. What is Docker Content Trust and image signing?**
Answer: Docker Content Trust (DCT) uses Notary to sign and verify images with cryptographic signatures, ensuring the image you pull is exactly what the publisher signed and has not been tampered with in transit or at rest. Enable it with `DOCKER_CONTENT_TRUST=1`; Docker will then refuse to pull or run unsigned images. Publishers sign images with a private key; consumers verify with a corresponding public key. In a production supply chain, combining DCT with image scanning (Trivy, Snyk, Grype) and a private registry with enforced signing policies provides strong image provenance guarantees.

---

**Q41. How do you pass secrets to a running container without embedding them in the image or environment variables?**
Answer: The recommended approaches are: Docker Secrets (Swarm mode) — secrets are encrypted at rest and in transit, mounted as files in `/run/secrets/<name>` visible only to the assigned service; BuildKit build secrets (`--secret`) for build-time only; or a secrets manager (HashiCorp Vault, AWS Secrets Manager) where the application fetches its own secrets at startup using an IAM role or Vault token. Environment variables are discouraged for secrets because they appear in `docker inspect` output, are passed to child processes, and can leak through logging. Files in `/run/secrets/` are readable only by the container process.

---

**Q42. How do you configure resource limits for containers in production?**
Answer: Resource limits are set at `docker run` time with `--memory` (hard memory limit), `--memory-reservation` (soft limit for scheduling), `--cpus` (fraction of host CPUs), and `--cpu-shares` (relative weight for contention). In Compose, use the `deploy.resources.limits` and `deploy.resources.reservations` keys (supported in Swarm mode). Without limits, a single misbehaving container can exhaust host resources and cause OOM kills or CPU starvation for all other containers. Setting limits also enables better bin-packing decisions by schedulers like Swarm and Kubernetes.

---

**Q43. What is the Docker socket and why is mounting it a security risk?**
Answer: The Docker socket (`/var/run/docker.sock`) is the Unix socket the Docker daemon listens on. Mounting it into a container with `-v /var/run/docker.sock:/var/run/docker.sock` gives that container full control over the Docker daemon — it can create privileged containers, mount host paths, pull and run arbitrary images, and effectively become root on the host. This is known as a "docker socket escape." It is commonly needed for CI agents (Jenkins, GitLab Runner) but should be treated as granting root on the host, restricted to trusted containers, and never exposed in application containers.

---

## Swarm & Orchestration (Q44–Q50)

**Q44. What is Docker Swarm and how does it differ from Kubernetes?**
Answer: Docker Swarm is Docker's built-in native clustering and orchestration mode. A Swarm cluster consists of manager nodes (which maintain cluster state using the Raft consensus algorithm) and worker nodes (which run containers). Swarm is simpler to set up and is tightly integrated with Docker CLI and Compose files. Kubernetes is far more feature-rich and is the industry standard for production orchestration, offering advanced scheduling, auto-scaling, extensible APIs, and a massive ecosystem. Swarm is appropriate for smaller teams or simpler workloads where operational simplicity outweighs Kubernetes's power.

---

**Q45. What is a Swarm service and how does it differ from a standalone container?**
Answer: A Swarm service is the declarative definition of a desired state for a workload: image, replica count, network, port mapping, update policy, and resource constraints. The Swarm manager continuously reconciles actual state to match desired state — if a replica fails, Swarm automatically starts a replacement. A standalone container has no reconciliation; if it dies, it stays dead unless you manually restart it. Services also support rolling updates and rollback, load balancing via the ingress mesh network, and placement constraints to control which nodes run which tasks.

---

**Q46. What is the Raft consensus algorithm's role in Docker Swarm?**
Answer: Swarm manager nodes use the Raft consensus algorithm to maintain a consistent, fault-tolerant view of cluster state. All configuration — services, tasks, networks, secrets — is stored in a distributed key-value store replicated across all manager nodes via Raft. A Raft quorum requires a majority of managers to be available: with 3 managers, 1 can fail; with 5, 2 can fail. If quorum is lost, the cluster becomes read-only — running containers continue, but no new scheduling decisions are made. This is why an odd number of managers (3 or 5) is recommended for HA clusters.

---

**Q47. How do rolling updates work in Docker Swarm?**
Answer: When you run `docker service update --image newimage:tag myservice`, Swarm performs a rolling update according to the service's update configuration: it stops `update-parallelism` tasks at a time, starts replacement tasks with the new image, waits for them to reach `Running` state (or pass health checks), then proceeds to the next batch. `update-delay` introduces a pause between batches to observe the new version under real traffic. If a batch fails, the update can be paused or rolled back automatically with `--update-failure-action rollback`. This enables zero-downtime deployments for stateless services.

---

**Q48. What are Docker Swarm secrets and how do they work?**
Answer: Docker Secrets provide a secure way to distribute sensitive data to Swarm services. Secrets are encrypted at rest in the Raft log using AES-256-GCM and transmitted to worker nodes over TLS-encrypted Swarm control plane connections. They are mounted as files in `/run/secrets/<name>` inside the container with `tmpfs` (in-memory), so they never touch worker node disk. Access is scoped — a secret is only sent to a node if a task that has been granted access to that secret is scheduled there. Unlike environment variables, secrets are not visible in `docker inspect` or passed to child processes.

---

**Q49. What is the difference between a Swarm service and a Swarm stack?**
Answer: A Swarm service is a single deployable unit (one image, one configuration). A Swarm stack is a collection of related services, networks, and volumes defined in a Compose file and deployed as a group with `docker stack deploy`. The stack is the Swarm equivalent of a Docker Compose project — it provides a namespace for all its resources and allows you to manage the full multi-service application as a single unit. Stacks support all Compose syntax plus Swarm-specific `deploy:` configuration (replicas, update policy, placement constraints, resources).

---

**Q50. When would you choose Docker Swarm over Kubernetes for a production deployment?**
Answer: Choose Swarm when: the team is small and operational complexity must be minimized; the application is a straightforward set of stateless services without exotic scheduling requirements; you already use Docker Compose and want a near-zero learning curve to production orchestration; or infrastructure budget limits the use of managed Kubernetes services. Choose Kubernetes when: you need advanced auto-scaling (HPA, VPA, KEDA), sophisticated traffic management (Istio, Gateway API), fine-grained RBAC, custom operators, or access to the broader CNCF ecosystem. Most greenfield production workloads at scale should default to Kubernetes unless Swarm's simplicity is a deliberate architectural choice.
