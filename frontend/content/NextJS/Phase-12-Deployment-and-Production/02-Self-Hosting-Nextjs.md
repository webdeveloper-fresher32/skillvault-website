# Self-Hosting Next.js

While Vercel is the recommended and easiest way to deploy Next.js, you are not locked into their platform. Next.js is a standard Node.js application and can be self-hosted on any provider that supports Node.js or Docker (e.g., AWS EC2, DigitalOcean, Heroku, Google Cloud Run).

There are two primary ways to self-host Next.js:
1. Using the standard Node.js server.
2. Using Docker containers.

## 1. Standard Node.js Server

To deploy to a standard Linux server or VPS, you need to build the application and then start the Next.js production server.

### Build and Start

In your `package.json`, you should have the standard Next.js scripts:
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  }
}
```

On your server:
1. Clone your repository.
2. Run `npm install` (or `yarn install` / `pnpm install`).
3. Run `npm run build` to generate the `.next` production build folder.
4. Run `npm run start` to start the Node.js server.

### Process Management with PM2

If you simply run `npm run start`, the server will stop if it crashes or if you close the terminal. In production, you should use a process manager like **PM2** to keep the app running and restart it on failure.

```bash
# Install PM2 globally
npm install -g pm2

# Build the app
npm run build

# Start the app with PM2
pm2 start npm --name "my-next-app" -- run start
```

## 2. Deploying with Docker

Docker is the industry standard for self-hosting because it packages your application and its environment into a portable container. 

Next.js provides a feature called **Standalone Output** which dramatically reduces the size of the Docker image.

### Enabling Standalone Output

Update your `next.config.js` to enable standalone mode:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
}
module.exports = nextConfig
```

When you run `next build`, Next.js will create a `.next/standalone` folder containing only the files and `node_modules` strictly necessary to run the production server.

### The Dockerfile

Here is a multi-stage `Dockerfile` optimized for Next.js standalone output:

```dockerfile
# Step 1: Install dependencies only when needed
FROM node:18-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Step 2: Rebuild the source code only when needed
FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Step 3: Production image, copy all the files and run next
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV production

# Next.js standalone output automatically copies public and static folders
# But we need to copy them explicitly in the Dockerfile
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
ENV PORT 3000

# Run the server using the standalone server.js
CMD ["node", "server.js"]
```

### Running the Container

```bash
# Build the Docker image
docker build -t my-next-app .

# Run the container mapping port 3000 to port 80
docker run -p 80:3000 my-next-app
```

## 3. Reverse Proxies (Nginx)

When self-hosting, it's a best practice to run a reverse proxy like **Nginx** in front of your Node.js or Docker application. Nginx handles SSL termination (HTTPS), serves static files more efficiently, and proxies dynamic requests to your Next.js server running on port 3000.

## Summary

- Next.js can be self-hosted on any Node.js environment.
- Use a process manager like **PM2** if running directly on a VPS.
- For Docker deployments, enable `output: 'standalone'` in `next.config.js` to create minimal, optimized images.
- Place a reverse proxy like Nginx in front of your Next.js application to handle SSL and load balancing.
