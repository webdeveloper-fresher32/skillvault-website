import type { NextConfig } from "next";

const PRODUCTION_BACKEND = 'https://skillvault-api.fly.dev';

// Robustly strip any trailing /api or / from env vars to avoid double /api/api rewrites
const rawTarget = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || PRODUCTION_BACKEND;
const backendTarget = rawTarget.replace(/\/api\/?$/, '').replace(/\/$/, '');

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
