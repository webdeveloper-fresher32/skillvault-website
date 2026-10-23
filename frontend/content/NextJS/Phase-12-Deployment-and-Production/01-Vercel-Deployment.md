# Deploying Next.js to Vercel

Vercel is the company behind Next.js. Deploying a Next.js application to Vercel is designed to be a zero-configuration, deeply integrated experience. 

When you deploy to Vercel, the platform automatically optimizes your application:
- **Static files and Client Components** are distributed across Vercel's Edge Network (CDN).
- **Server Components and API Routes** are automatically converted into Serverless Functions.
- **Middleware** is deployed to Edge Functions for ultra-low latency routing.
- **Images** are automatically optimized using the built-in Next.js Image component and Vercel's image optimization service.

## 1. Deploying via the Vercel Dashboard

The most common way to deploy is by linking your GitHub, GitLab, or Bitbucket repository to Vercel.

1. Push your Next.js code to a Git repository (e.g., GitHub).
2. Create an account at [Vercel.com](https://vercel.com).
3. Click **Add New** > **Project**.
4. Import your Git repository.
5. Vercel will automatically detect that it's a Next.js project. You can review the Build Command (`next build`) and Output Directory (`.next`), but usually, no changes are needed.
6. Add any required **Environment Variables** (e.g., Database URLs, API keys).
7. Click **Deploy**.

Vercel will now automatically trigger a new build and deployment every time you push to the `main` branch. 

## 2. Preview Deployments

One of the most powerful features of Vercel is **Preview Deployments**.

Whenever you open a Pull Request (or push to a non-main branch), Vercel automatically creates a unique, ephemeral URL for that specific branch. This allows your team to preview, test, and comment on changes before they are merged into production.

## 3. Deploying via Vercel CLI

If you prefer using the terminal, you can deploy your application using the Vercel CLI.

```bash
# Install the Vercel CLI globally
npm i -g vercel

# Inside your Next.js project directory, run:
vercel
```

The CLI will prompt you to log in, link a project, and then it will build and deploy a Preview URL. 

To deploy directly to production from the CLI, use the `--prod` flag:

```bash
vercel --prod
```

## 4. Environment Variables on Vercel

Managing secrets securely is critical for production apps.
- **Never commit `.env` or `.env.local` files to Git.**
- Instead, go to your Project Settings on Vercel > Environment Variables.
- You can add variables and specify which environments they apply to (Production, Preview, or Development).
- When running `vercel dev` locally, the Vercel CLI can automatically pull these environment variables down to your local machine, ensuring parity between local and production environments.

## Summary

- Vercel provides the easiest and most optimized hosting for Next.js.
- Git integration enables automatic production deployments and Preview Deployments for Pull Requests.
- The Vercel CLI (`vercel` and `vercel --prod`) allows for quick terminal-based deployments.
- Manage sensitive data using Vercel's Environment Variables dashboard, not by committing `.env` files.
