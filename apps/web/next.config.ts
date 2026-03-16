import type { NextConfig } from "next";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const nextConfig: NextConfig = {
	reactStrictMode: false,
	experimental: {
		reactCompiler: true,
	},
	eslint: {
		// ESLint is run separately via `pnpm lint`. Don't block builds on pre-existing warnings.
		ignoreDuringBuilds: true,
	},
	typescript: {
		// Type checking is run separately. Don't block builds on pre-existing errors.
		ignoreBuildErrors: true,
	},
	// Enable standalone output for Docker deployments
	// Note: standalone requires symlink permissions on Windows; disabled for local builds
	output: process.env.NEXT_STANDALONE === '1' ? "standalone" : undefined,
	// Proxy /api/* to the Fastify backend so media elements (video, audio, img)
	// can load via same-origin requests that carry session cookies automatically.
	async rewrites() {
		return [
			{
				source: "/api/:path*",
				destination: `${API_URL}/api/:path*`,
			},
			{
				// Same-origin proxy for video/audio — avoids CORS issues for canvas thumbnail extraction
				source: '/media-proxy/:path*',
				destination: `${API_URL}/api/:path*`,
			},
		];
	},
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
