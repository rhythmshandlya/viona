/**
 * Remotion configuration for Claude Code visual generation.
 * Auto-detects platform for correct GPU/headless settings.
 */

import { Config } from "@remotion/cli/config";

// Use software rendering in Linux containers (no GPU), ANGLE on Windows
const isLinux = process.platform === "linux";
Config.setChromiumOpenGlRenderer(isLinux ? "swangle" : "angle");

// Disable web security for local rendering
Config.setChromiumDisableWebSecurity(true);

// Increase timeouts for complex renders
Config.setTimeoutInMilliseconds(120000);

// Use headless mode for rendering
Config.setChromiumHeadlessMode("shell");
