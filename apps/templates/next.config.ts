import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  transpilePackages: ["@viona/templates"],
  webpack: (config, { isServer }) => {
    // getFiles() in template registrations uses dynamic import('fs') / import('path')
    // which is Node.js-only (for agent integration). Stub them out in client bundles.
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }
    return config;
  },
};

export default nextConfig;
