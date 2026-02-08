import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	reactStrictMode: false,
	eslint: {
		// ESLint is run separately via `pnpm lint`. Don't block builds on pre-existing warnings.
		ignoreDuringBuilds: true,
	},
	// Enable standalone output for Docker deployments
	output: "standalone",
};

export default nextConfig;
