# Docker Cheatsheet

---

### Images

```bash
docker build -t myapp:1.0 .                         # Build image from Dockerfile in current dir
docker build -t myapp:1.0 -f Dockerfile.prod .      # Build using a specific Dockerfile
docker build --no-cache -t myapp:1.0 .              # Build without using layer cache
docker pull nginx:latest                             # Pull image from registry
docker push myrepo/myapp:1.0                        # Push image to registry
docker tag myapp:1.0 myrepo/myapp:1.0               # Tag an existing image
docker images                                        # List all local images
docker image ls                                      # Same as docker images
docker image rm myapp:1.0                           # Remove an image
docker rmi myapp:1.0                                # Same as docker image rm
docker image prune                                   # Remove dangling (untagged) images
docker image prune -a                               # Remove all unused images
docker history myapp:1.0                            # Show layer history of an image
docker inspect myapp:1.0                            # Full JSON metadata for an image
docker save myapp:1.0 | gzip > myapp.tar.gz        # Export image to tar archive
docker load < myapp.tar.gz                          # Load image from tar archive
```

---

### Containers

```bash
docker run nginx                                     # Run container (foreground)
docker run -d nginx                                  # Run container in detached (background) mode
docker run -it ubuntu bash                           # Interactive terminal session
docker run --name web nginx                          # Assign a custom name
docker run -p 8080:80 nginx                          # Map host port 8080 to container port 80
docker run -P nginx                                  # Map all exposed ports to random host ports
docker run -e ENV_VAR=value nginx                   # Set an environment variable
docker run --env-file .env nginx                    # Load env vars from file
docker run -v /host/path:/container/path nginx      # Bind mount
docker run -v myvolume:/data nginx                  # Named volume mount
docker run --mount type=bind,src=$(pwd),dst=/app nginx  # Explicit mount syntax
docker run --network mynet nginx                    # Attach to a custom network
docker run --rm nginx                               # Auto-remove container on exit
docker run --restart always nginx                   # Always restart on failure/reboot
docker run --restart on-failure:3 nginx             # Restart up to 3 times on failure
docker run --memory 512m --cpus 1.5 nginx           # Limit memory and CPU
docker run --user 1000:1000 nginx                   # Run as specific user:group
docker run --read-only nginx                        # Read-only root filesystem
docker run --cap-drop ALL --cap-add NET_BIND_SERVICE nginx  # Drop all caps, add one

docker ps                                            # List running containers
docker ps -a                                         # List all containers (including stopped)
docker ps -q                                         # List only container IDs

docker start web                                     # Start a stopped container
docker stop web                                      # Gracefully stop (SIGTERM + SIGKILL after 10s)
docker stop -t 30 web                               # Custom stop timeout (seconds)
docker restart web                                   # Stop then start
docker kill web                                      # Send SIGKILL immediately

docker rm web                                        # Remove a stopped container
docker rm -f web                                     # Force remove a running container
docker rm $(docker ps -aq)                          # Remove all stopped containers

docker exec -it web bash                             # Open interactive shell in running container
docker exec web ls /app                             # Run a command in a running container

docker logs web                                      # Show container logs
docker logs -f web                                   # Follow (tail) logs
docker logs --tail 100 web                          # Show last 100 lines
docker logs --since 10m web                         # Logs from last 10 minutes

docker inspect web                                   # Full JSON metadata for a container
docker stats                                         # Live resource usage for all containers
docker stats web                                     # Resource usage for one container
docker top web                                       # Running processes inside container

docker cp web:/app/config.yaml ./config.yaml        # Copy file from container to host
docker cp ./config.yaml web:/app/config.yaml        # Copy file from host to container
```

---

### Networks

```bash
docker network create mynet                          # Create a bridge network
docker network create --driver overlay mynet        # Create an overlay network (Swarm)
docker network create --subnet 192.168.1.0/24 mynet # Create with custom subnet
docker network ls                                    # List all networks
docker network rm mynet                              # Remove a network
docker network inspect mynet                        # Full JSON details of a network
docker network connect mynet web                    # Connect a running container to a network
docker network disconnect mynet web                 # Disconnect a container from a network
docker network prune                                # Remove all unused networks
```

---

### Volumes

```bash
docker volume create mydata                          # Create a named volume
docker volume ls                                     # List all volumes
docker volume rm mydata                              # Remove a volume
docker volume inspect mydata                        # Show volume details (mountpoint, etc.)
docker volume prune                                  # Remove all unused volumes
```

---

### Docker Compose

```bash
docker compose up                                    # Create and start all services
docker compose up -d                                 # Start in detached mode
docker compose up --build                           # Rebuild images before starting
docker compose up --scale web=3                     # Start with 3 replicas of web

docker compose down                                  # Stop and remove containers + networks
docker compose down -v                              # Also remove volumes
docker compose down --rmi all                       # Also remove images

docker compose ps                                    # List running services
docker compose logs                                  # Show logs for all services
docker compose logs -f web                          # Follow logs for one service

docker compose exec web bash                        # Shell into a running service
docker compose run --rm web python manage.py migrate  # One-off command in new container

docker compose build                                 # Build all service images
docker compose build web                            # Build only one service
docker compose pull                                  # Pull latest images for all services
docker compose restart web                          # Restart a service

docker compose config                               # Validate and view merged compose config
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d  # Merge multiple files
```

---

### Docker Swarm

```bash
docker swarm init                                    # Initialize this node as Swarm manager
docker swarm init --advertise-addr 192.168.1.10     # Specify manager IP
docker swarm join --token <token> 192.168.1.10:2377 # Join as a worker node
docker swarm join-token worker                      # Display worker join token
docker swarm join-token manager                     # Display manager join token
docker swarm leave                                   # Leave the swarm (worker)
docker swarm leave --force                          # Force leave (manager)

docker node ls                                       # List all nodes in the swarm
docker node inspect <node>                          # Inspect a node
docker node update --availability drain <node>      # Drain a node before maintenance
docker node promote <node>                          # Promote worker to manager
docker node demote <node>                           # Demote manager to worker

docker service create --name web -p 80:80 --replicas 3 nginx  # Create a service
docker service ls                                    # List all services
docker service ps web                               # List tasks (containers) for a service
docker service logs web                             # View service logs
docker service scale web=5                          # Scale service to 5 replicas
docker service update --image nginx:1.25 web        # Rolling update to new image
docker service update --rollback web                # Rollback to previous version
docker service rm web                               # Remove a service
docker service inspect web                         # Full service details

docker stack deploy -c docker-compose.yml mystack  # Deploy a stack from compose file
docker stack ls                                      # List stacks
docker stack ps mystack                             # List tasks in a stack
docker stack services mystack                       # List services in a stack
docker stack rm mystack                             # Remove an entire stack
```

---

### Cleanup

```bash
docker system prune                                  # Remove stopped containers, unused networks, dangling images
docker system prune -a                              # Also remove all unused images
docker system prune -a --volumes                    # Also remove unused volumes
docker system df                                     # Show disk usage by Docker objects

docker image prune                                   # Remove dangling images only
docker image prune -a                               # Remove all unused images
docker container prune                              # Remove all stopped containers
docker volume prune                                  # Remove all unused volumes
docker network prune                                # Remove all unused networks
```

---

### BuildKit / Advanced

```bash
# Enable BuildKit (set in env or daemon config)
DOCKER_BUILDKIT=1 docker build -t myapp .

# Buildx — multi-platform builds
docker buildx create --use --name mybuilder        # Create and activate a buildx builder
docker buildx build --platform linux/amd64,linux/arm64 -t myrepo/myapp:latest --push .

# Build-time secrets (never baked into layers)
docker buildx build --secret id=mysecret,src=./secret.txt -t myapp .
# In Dockerfile: RUN --mount=type=secret,id=mysecret cat /run/secrets/mysecret

# SSH forwarding for private repos during build
docker buildx build --ssh default=$SSH_AUTH_SOCK -t myapp .
# In Dockerfile: RUN --mount=type=ssh git clone git@github.com:org/repo.git

# Build cache export/import (CI optimization)
docker buildx build --cache-to type=registry,ref=myrepo/cache --cache-from type=registry,ref=myrepo/cache -t myapp --push .

# Inspect final image layers
docker buildx imagetools inspect myrepo/myapp:latest
```
