import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // If local external backend URL is explicitly configured (e.g. http://localhost:8080), proxy to it.
  // Otherwise, Next.js serves its own built-in high-performance serverless Node.js API routes!
  async rewrites() {
    const rules = [
      {
        source: '/api/v1/rag/:path*',
        destination: '/api/rag/:path*',
      },
    ];

    const customBackend = process.env.BACKEND_URL;
    if (
      customBackend &&
      !customBackend.includes('onrender.com') &&
      !customBackend.includes('fly.dev')
    ) {
      const backendTarget = customBackend.replace(/\/api\/?$/, '').replace(/\/$/, '');
      rules.push({
        source: '/api/:path*',
        destination: `${backendTarget}/api/:path*`,
      });
    }
    return rules;
  },
};

export default nextConfig;
