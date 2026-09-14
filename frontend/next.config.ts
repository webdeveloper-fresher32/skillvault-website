import type { NextConfig } from "next";

const backendTarget = 
  process.env.BACKEND_URL || 
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '') || 
  'https://skillvault-website-backend.onrender.com';

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
