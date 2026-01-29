/**
 * Remotion configuration for Docker sandbox environment.
 * Uses chrome-headless-shell (auto-downloaded by Remotion v4.0.247+)
 */

import { Config } from "@remotion/cli/config";

// Remotion v4.0.247+ auto-downloads chrome-headless-shell
// No need to set browser executable manually
// See: https://www.remotion.dev/docs/miscellaneous/chrome-headless-shell

// Configure Chromium launch options for Docker
Config.setChromiumOpenGlRenderer("angle");
Config.setChromiumDisableWebSecurity(true);

// Increase timeouts for Docker environments
Config.setTimeoutInMilliseconds(120000);

// Use "shell" for chrome-headless-shell (new headless mode)
Config.setChromiumHeadlessMode("shell");
