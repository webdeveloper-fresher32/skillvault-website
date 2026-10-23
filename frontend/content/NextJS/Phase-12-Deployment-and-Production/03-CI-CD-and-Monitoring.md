# CI/CD and Production Monitoring

When deploying a Next.js application, setting up Continuous Integration and Continuous Deployment (CI/CD), along with proper production monitoring, ensures your app remains stable and performant as it scales.

## 1. Continuous Integration (CI)

Before code is deployed to production, it should be tested and verified. This is where CI pipelines (like GitHub Actions, GitLab CI, or CircleCI) come in.

A standard Next.js CI pipeline should:
1. Install dependencies.
2. Run a linter (`npm run lint`).
3. Run tests (e.g., Jest or Cypress).
4. Verify the build succeeds (`npm run build`).

### Example GitHub Action for CI

```yaml
# .github/workflows/ci.yml
name: Next.js CI

on:
  push:
    branches: [ "main" ]
  pull_request:
    branches: [ "main" ]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Use Node.js 18
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
      
    - name: Run Linter
      run: npm run lint
      
    - name: Run Build
      run: npm run build
      
    # - name: Run Tests
    #   run: npm test
```

## 2. Continuous Deployment (CD)

If you are using Vercel, CD is handled automatically when you merge to `main`. 

If you are self-hosting with Docker, your CD pipeline (running after the CI steps above) might look like this:
1. Build the Docker image.
2. Push the image to a container registry (like Docker Hub or AWS ECR).
3. SSH into your production server and pull the new image, or update your Kubernetes cluster.

## 3. Web Vitals and Analytics

Next.js has built-in support for measuring **Core Web Vitals** (metrics that measure user experience like loading speed, interactivity, and visual stability).

You can capture these metrics using the `useReportWebVitals` hook in a Client Component, or seamlessly integrate with Vercel Analytics.

```tsx
// app/components/WebVitals.tsx
'use client'

import { useReportWebVitals } from 'next/web-vitals'

export function WebVitals() {
  useReportWebVitals((metric) => {
    // Send metric to your analytics service (e.g., Google Analytics, Datadog)
    console.log(metric.name, metric.value)
    
    // Example: fetch('/api/analytics', { body: JSON.stringify(metric) })
  })
  
  return null
}
```

Then, include this component in your root `layout.tsx`:
```tsx
import { WebVitals } from './components/WebVitals'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <WebVitals />
        {children}
      </body>
    </html>
  )
}
```

## 4. Error Tracking (Sentry)

In production, you need to know when your users encounter errors. Using a tool like **Sentry** is highly recommended for Next.js. Sentry captures unhandled exceptions in both Server and Client Components and provides detailed stack traces.

Next.js provides an official `@sentry/nextjs` SDK that wraps your application automatically, hooking into `error.js` and `global-error.js` boundaries.

## Summary

- Use **GitHub Actions** (or similar tools) to run Linters, Tests, and Builds on every Pull Request.
- Capture **Core Web Vitals** using the `useReportWebVitals` hook to monitor real-user performance.
- Implement an error tracking tool like **Sentry** to get immediate alerts when runtime errors occur in production.
