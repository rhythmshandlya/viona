/**
 * Build stdio MCP server configuration for the Agent SDK query() call.
 * These servers run as child processes alongside the in-process SDK MCP servers.
 */

const MCP_SERVERS_DIR = '/app/mcp-servers';
const MCP_REMOTE_PATH = '/app/node_modules/mcp-remote/dist/proxy.js';
const BETTER_ICONS_PATH = '/app/node_modules/better-icons/dist/index.js';
const WORKSPACE = '/workspace';

export function buildStdioMcpServers(): Record<string, unknown> {
  const servers: Record<string, unknown> = {};

  // Assets server — download files, search stock photos, speaker grid
  servers.assets = {
    command: 'node',
    args: [`${MCP_SERVERS_DIR}/asset-server.js`, '--workspace', WORKSPACE],
    env: {
      UNSPLASH_ACCESS_KEY: process.env.UNSPLASH_ACCESS_KEY || '',
      PEXELS_API_KEY: process.env.PEXELS_API_KEY || '',
    },
  };

  // Viewport server — scene dimensions, code validation
  servers.viewport = {
    command: 'node',
    args: [`${MCP_SERVERS_DIR}/viewport-server.js`, '--workspace', WORKSPACE],
  };

  // Freepik MCP proxy (only if API key is set)
  if (process.env.FREEPIK_API_KEY) {
    servers.freepik = {
      command: 'node',
      args: [
        MCP_REMOTE_PATH,
        'https://api.freepik.com/mcp',
        '--header',
        `x-freepik-api-key:${process.env.FREEPIK_API_KEY}`,
      ],
    };
  }

  // Better-Icons (Iconify) — no API key needed
  servers['better-icons'] = {
    command: 'node',
    args: [BETTER_ICONS_PATH],
  };

  return servers;
}
