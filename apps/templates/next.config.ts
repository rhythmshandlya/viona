import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

    // Force all packages to use the same copy of remotion
    // to prevent duplicate context issues with @remotion/player <Thumbnail>
    config.resolve.alias = {
      ...config.resolve.alias,
      remotion: path.resolve(__dirname, "node_modules/remotion"),
    };

    return config;
  },
};

export default nextConfig;
