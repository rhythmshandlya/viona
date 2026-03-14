import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	reactStrictMode: false,
	experimental: {
		reactCompiler: true,
	},
	eslint: {
		// ESLint is run separately via `pnpm lint`. Don't block builds on pre-existing warnings.
		ignoreDuringBuilds: true,
	},
	// Enable standalone output for Docker deployments
	// Note: standalone requires symlink permissions on Windows; disabled for local builds
	output: process.env.NEXT_STANDALONE === '1' ? "standalone" : undefined,
	webpack: (config, { isServer }) => {
		// @viona/templates register files dynamically import 'fs' for getTemplateFiles().
		// On the client side, fs is not available — stub it out since those code paths
		// are only reached server-side (template file listing).
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
