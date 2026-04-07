import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allows build to succeed even if optional env vars (VAPI, n8n) are not set yet
  // Required vars (Supabase) must be set in Vercel environment settings
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
