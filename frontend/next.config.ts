import type { NextConfig } from "next";

const RENDER_BACKEND = 'https://skillvault-website-backend.onrender.com';

// Use explicit BACKEND_URL, NEXT_PUBLIC_API_URL, or default to production Render backend
const backendTarget = 
  process.env.BACKEND_URL || 
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '') || 
  RENDER_BACKEND;

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
