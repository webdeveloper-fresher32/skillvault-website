# The 12-Factor App

In 2011, the engineers at Heroku (a pioneering PaaS company) published **The Twelve-Factor App**, a methodology for building software-as-a-service (SaaS) applications. 

Today, these 12 factors are considered the gold standard for building Cloud-Native microservices. If your application adheres to these 12 factors, it is guaranteed to be scalable, portable, and cloud-ready.

## The 12 Factors

### 1. Codebase
**One codebase tracked in revision control, many deploys.**
There should be exactly one Git repository per microservice. If multiple codebases share the same app, it's a distributed system, not an app. If multiple apps share the same code, it's a violation (extract it to a library instead).

### 2. Dependencies
**Explicitly declare and isolate dependencies.**
An app should never rely on the implicit existence of system tools (like `curl` or ImageMagick) on the host machine. Everything the app needs must be declared in a package manager (e.g., `package.json`, `requirements.txt`) and packaged with the app (usually via Docker).

### 3. Config
**Store config in the environment.**
Configuration (database credentials, API keys) varies across deployments (Dev, Staging, Prod). Code does not. Therefore, config must *never* be hardcoded in the codebase. It should be injected at runtime via Environment Variables.

### 4. Backing Services
**Treat backing services as attached resources.**
A backing service is any service the app consumes over the network (Databases, Redis, SMTP servers). The app should make no distinction between a local MySQL database and a managed AWS RDS database. It should be swappable simply by changing the connection string in the environment config.

### 5. Build, Release, Run
**Strictly separate build and run stages.**
You cannot make changes to code running in production. Code must be built into an executable bundle, combined with config to create a Release, and then run. If a bug is found in production, you must fix it in the codebase and push it through the Build pipeline again.

### 6. Processes
**Execute the app as one or more stateless processes.**
Twelve-factor processes are stateless and share-nothing. Any data that needs to persist must be stored in a stateful backing service (like a database). Memory or local disk space can only be used as a brief, single-transaction cache (never assume the next request will go to the same server process).

### 7. Port Binding
**Export services via port binding.**
The app is completely self-contained. It doesn't rely on a host webserver (like Apache or Tomcat) being installed. It binds to a port (e.g., `3000`) and listens for requests directly (e.g., using an embedded Express.js or Spring Boot server).

### 8. Concurrency
**Scale out via the process model.**
When you need to handle more traffic, you do not make the single process larger (vertical scaling). Instead, you add *more* identical processes (horizontal scaling). 

### 9. Disposability
**Maximize robustness with fast startup and graceful shutdown.**
Because clouds are ephemeral, servers can be destroyed at any moment. Your app should start up in seconds. It should also handle SIGTERM signals gracefully, finishing current requests and closing database connections cleanly before shutting down.

### 10. Dev/Prod Parity
**Keep development, staging, and production as similar as possible.**
Historically, developers used SQLite locally and PostgreSQL in production, leading to "it works on my machine" bugs. A 12-factor app uses the exact same backing services in all environments (usually facilitated by running Postgres in Docker locally).

### 11. Logs
**Treat logs as event streams.**
The app should not attempt to write or manage log files (`app.log`) on the local disk. It should simply write all logs unbuffered to `stdout` / `stderr`. The surrounding infrastructure (e.g., Fluentd, DataDog) is responsible for capturing that stream and routing it to a centralized logging system.

### 12. Admin Processes
**Run admin/management tasks as one-off processes.**
Database migrations, one-off scripts, or REPL consoles should run in an identical environment as the regular long-running processes of the app (same codebase, same config).
