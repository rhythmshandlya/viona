/**
 * Remotion configuration for Claude Code visual generation.
 * Optimized for Windows local execution.
 */

import { Config } from "@remotion/cli/config";

// Use ANGLE renderer for better Windows compatibility
Config.setChromiumOpenGlRenderer("angle");

// Disable web security for local rendering
Config.setChromiumDisableWebSecurity(true);

// Increase timeouts for complex renders
Config.setTimeoutInMilliseconds(120000);

// Use headless mode for rendering
Config.setChromiumHeadlessMode("shell");
