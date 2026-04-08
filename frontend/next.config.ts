import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Lint errors won't fail Vercel builds — run lint separately in CI if needed
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
