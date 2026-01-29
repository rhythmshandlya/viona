import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { screenshotTool, handleScreenshot } from './tools/screenshot.js';
import { compositionInfoTool, handleCompositionInfo } from './tools/composition-info.js';
import { validateTool, handleValidate } from './tools/validate.js';
import { transcriptTool, handleTranscript } from './tools/transcript.js';

const server = new Server(
  {
    name: 'reelify-mcp-tools',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      screenshotTool,
      compositionInfoTool,
      validateTool,
      transcriptTool,
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'screenshot':
      return handleScreenshot(args);
    case 'getCompositionInfo':
      return handleCompositionInfo(args);
    case 'validateProject':
      return handleValidate(args);
    case 'getTranscript':
      return handleTranscript(args);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Reelify MCP Tools server running');
}

main().catch(console.error);
