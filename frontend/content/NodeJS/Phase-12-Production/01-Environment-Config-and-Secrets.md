# Environment Config and Secrets — Complete Guide

## Table of Contents
1. [Why Environment Config Matters](#1-why-environment-config-matters)
2. [NODE_ENV](#2-node_env)
3. [Config Per Environment](#3-config-per-environment)
4. [dotenv](#4-dotenv)
5. [Secrets Management](#5-secrets-management)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Why Environment Config Matters

The same codebase runs in dev, test, staging, and production — but each needs different database URLs, API keys, log levels, and feature flags. Hardcoding any of this breaks portability and leaks secrets into source control.

```
Bad:  const dbUrl = "mongodb://prod-user:P@ssw0rd@prod-db:27017/app"
Good: const dbUrl = process.env.DATABASE_URL
```

The **twelve-factor app** principle: store config in the environment, not in code.

---

## 2. NODE_ENV

`NODE_ENV` is the de-facto standard variable that tells Node (and libraries like Express) which mode to run in.

```javascript
// server.js
console.log(`Running in ${process.env.NODE_ENV} mode`);

if (process.env.NODE_ENV === 'production') {
  app.use(compression());       // enable gzip
  app.set('trust proxy', 1);    // behind a load balancer
} else {
  app.use(morgan('dev'));       // verbose request logging in dev
}
```

Express itself checks `NODE_ENV`:
- `production` → view caching enabled, less verbose error pages
- anything else → assumes development

```bash
# Setting it when starting the app
NODE_ENV=production node server.js

# Common values
NODE_ENV=development
NODE_ENV=test
NODE_ENV=staging
NODE_ENV=production
```

**Never let `NODE_ENV` default silently.** Explicitly check for it at startup and fail fast if it's missing in production:

```javascript
if (!process.env.NODE_ENV) {
  console.error('FATAL: NODE_ENV is not set');
  process.exit(1);
}
```

---

## 3. Config Per Environment

Centralize config in one module so the rest of the app never touches `process.env` directly.

```javascript
// config/index.js
const required = (key) => {
  const value = process.env[key];
  if (value === undefined) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
};

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),

  db: {
    url: required('DATABASE_URL'),
    poolSize: parseInt(process.env.DB_POOL_SIZE || '10', 10),
  },

  jwt: {
    secret: required('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  logLevel: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
};

module.exports = config;
```

```javascript
// usage anywhere in the app
const config = require('./config');
app.listen(config.port);
```

Benefits:
- One place to see every config value the app depends on.
- Fails fast at startup (not mid-request) if something required is missing.
- Easy to mock in tests — just import a different config module or stub it.

### Per-environment files (optional layering)

Some teams keep a base config plus per-environment overrides:

```
config/
├── default.js       # shared defaults
├── development.js   # overrides for dev
├── production.js    # overrides for prod
└── index.js         # merges default + NODE_ENV-specific file
```

```javascript
// config/index.js
const env = process.env.NODE_ENV || 'development';
const defaults = require('./default');
const override = require(`./${env}`);
module.exports = { ...defaults, ...override };
```

---

## 4. dotenv

In local development, exporting env vars manually is tedious. `dotenv` loads a `.env` file into `process.env`.

```bash
npm install dotenv
```

```
# .env  (local machine only — NEVER commit this file)
NODE_ENV=development
PORT=3000
DATABASE_URL=mongodb://localhost:27017/myapp_dev
JWT_SECRET=dev-only-secret-do-not-use-in-prod
REDIS_URL=redis://localhost:6379
```

```javascript
// at the very top of server.js / app entry point
require('dotenv').config();

const config = require('./config');
// process.env.DATABASE_URL is now populated from .env
```

```
# .gitignore
.env
.env.local
.env.*.local
```

Commit a template instead, so teammates know which variables exist:

```
# .env.example  (committed — placeholder values only)
NODE_ENV=development
PORT=3000
DATABASE_URL=
JWT_SECRET=
REDIS_URL=redis://localhost:6379
```

**Important:** `dotenv` is a development convenience. In staging/production, environment variables are injected by the platform (Docker `-e`/`--env-file`, Kubernetes `Secret`/`ConfigMap`, CI/CD pipeline variables, PaaS dashboard) — `.env` files are typically not deployed at all.

---

## 5. Secrets Management

Secrets (DB passwords, JWT signing keys, API keys, TLS certs) need stricter handling than ordinary config.

### Rules

1. **Never commit secrets.** Not in `.env`, not in code, not in commit history (once committed, rotate it — removing it from git history doesn't un-leak it).
2. **Never log secrets.** Redact them in structured logs (see `04-Logging-and-Monitoring.md`).
3. **Different secrets per environment.** Dev, staging, and prod must never share credentials.
4. **Rotate secrets periodically** and immediately after any suspected leak.
5. **Principle of least privilege** — a service should only have credentials for the resources it actually needs.

### Where secrets actually live in production

| Approach | Description |
|----------|-------------|
| **Platform env vars** | Injected by the hosting platform (Heroku config vars, Docker `--env-file`, systemd `EnvironmentFile`) — simplest, fine for small teams |
| **Kubernetes Secrets** | Base64-encoded objects mounted as env vars or files into pods (see `../../Kubernetes/`) — better, but base64 is not encryption by itself |
| **Cloud secrets manager** | AWS Secrets Manager, GCP Secret Manager, Azure Key Vault — secrets are encrypted at rest, access is IAM-controlled, and rotation can be automated |
| **HashiCorp Vault** | Self-hosted/managed secrets engine with dynamic secrets (e.g., short-lived DB credentials), audit logging, and fine-grained policies |

Conceptual flow with a cloud secrets manager:

```javascript
// startup.js (conceptual — SDK calls vary by provider)
async function loadSecrets() {
  const secretsClient = new SecretsManagerClient();
  const dbSecret = await secretsClient.getSecretValue({ SecretId: 'prod/db/credentials' });
  const jwtSecret = await secretsClient.getSecretValue({ SecretId: 'prod/jwt/signing-key' });

  process.env.DATABASE_URL = dbSecret.connectionString;
  process.env.JWT_SECRET = jwtSecret.value;
}

// call before requiring ./config
await loadSecrets();
const config = require('./config');
```

The app code doesn't change — it still reads `process.env`. Only *how* those values get populated changes between environments (`.env` file locally, secrets manager fetch in production).

### Detecting leaked secrets

- Use a pre-commit hook or CI step (e.g., a secret-scanning tool) that blocks commits containing patterns like API keys or private keys.
- Add `.env` to `.gitignore` on day one of the project — before the first commit, not after a leak.

---

## 6. Hands-On Exercises

**Exercise 1:** Create a `config/index.js` that reads `PORT`, `DATABASE_URL`, and `JWT_SECRET` from `process.env`, throws on startup if `JWT_SECRET` is missing, and defaults `PORT` to `3000`.

**Exercise 2:** Install `dotenv`, create a `.env` file with those three variables, and confirm `require('dotenv').config()` populates `process.env` correctly. Add `.env` to `.gitignore` and commit a `.env.example` instead.

**Exercise 3:** Refactor an Express app so that every `process.env.X` reference in route/controller files is replaced with `config.x` from your centralized config module.

**Exercise 4:** Write a small script that scans a directory for `.js` files and flags any line containing a hardcoded string that looks like a secret (e.g., matches `password\s*=\s*['"]`). This simulates what a secret-scanning CI step does.

**Exercise 5:** Simulate promoting an app from dev to "prod": change `NODE_ENV=production`, remove the `.env` file, and set the same variables via shell exports (`export DATABASE_URL=...`) instead. Confirm the app still boots correctly.

---

## 7. Interview Q&A

**Q: What is `NODE_ENV` and why does it matter?**
Answer: `NODE_ENV` is a convention-based environment variable that signals which mode the app is running in (development, test, production). Express and many libraries check it to toggle behavior — e.g., enabling view caching and terser error pages in production, or verbose logging in development. It should be set explicitly and never left to default silently in production.

**Q: Why shouldn't you commit a `.env` file to version control?**
Answer: `.env` files typically contain secrets (DB credentials, API keys, signing keys). Committing them exposes those secrets to anyone with repo access, and they remain in git history even after deletion. Instead, `.env` is gitignored, and a `.env.example` with placeholder keys (no real values) is committed so teammates know what variables are needed.

**Q: What's the difference between config and secrets, and should they be managed the same way?**
Answer: Config is non-sensitive settings (port, log level, feature flags) — fine in plain env vars or config files. Secrets are sensitive credentials (passwords, API keys, signing keys) that need stricter controls: encryption at rest, access control, rotation, and audit logging. In production, secrets are best sourced from a dedicated secrets manager (AWS Secrets Manager, Vault) rather than plain environment variables where feasible.

**Q: How would you fail fast if a required environment variable is missing?**
Answer: Validate required env vars at application startup — before the server starts listening — by checking `process.env` and throwing/exiting immediately if a required key is undefined. This surfaces misconfiguration immediately at deploy time instead of causing a cryptic runtime error later when that variable is first used.

**Q: How do secrets get into a containerized or Kubernetes-deployed Node app if you can't use a `.env` file?**
Answer: In Docker, secrets are typically passed via `--env-file` (kept outside the image) or `-e` at runtime, never baked into the image with `COPY`. In Kubernetes, secrets are stored as `Secret` objects and injected into pods as environment variables or mounted files at deploy time. The application code is unchanged — it still reads `process.env` — only the mechanism populating it differs per platform.

**Q: What's a security risk of putting secrets directly in a Dockerfile with `ENV` or `ARG`?**
Answer: Values set via `ENV`/`ARG` in a Dockerfile get baked into the image layers and are visible via `docker history` or by inspecting the image, even if a later layer overwrites them. Secrets should be injected at container runtime (env vars, mounted secret files, orchestrator secrets) rather than at build time.
