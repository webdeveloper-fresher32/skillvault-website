import type { NextConfig } from "next";

const PRODUCTION_BACKEND = 'https://skillvault-api.fly.dev';

// Use explicit BACKEND_URL, NEXT_PUBLIC_API_URL, or default to production Fly backend
const backendTarget = 
  process.env.BACKEND_URL || 
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '') || 
  PRODUCTION_BACKEND;

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendTarget}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
