import { execa } from 'execa';
import { join } from 'path';

const REMOTION_PROJECT_DIR = process.env.REMOTION_PROJECT_DIR || 'C:/Users/armaa/test';

export const compositionInfoTool = {
  name: 'getCompositionInfo',
  description: 'Get metadata about a Remotion composition including duration, fps, width, and height.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      compositionId: {
        type: 'string',
        description: 'The ID of the Remotion composition to get info for',
      },
    },
    required: ['compositionId'],
  },
};

interface CompositionInfo {
  id: string;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
}

export async function handleCompositionInfo(args: unknown): Promise<{
  content: Array<{ type: string; text: string }>;
}> {
  const { compositionId } = args as { compositionId: string };
  const entryPoint = join(REMOTION_PROJECT_DIR, 'src/index.ts');

  try {
    // Run remotion compositions command to get JSON output
    const result = await execa('npx', [
      'remotion',
      'compositions',
      entryPoint,
      '--props={}',
    ], {
      cwd: REMOTION_PROJECT_DIR,
      timeout: 30000,
    });

    // Parse the output to find the composition
    const lines = result.stdout.split('\n');
    let compositionInfo: CompositionInfo | null = null;

    for (const line of lines) {
      if (line.includes(compositionId)) {
        // Parse composition info from output
        // Format is typically: "CompositionId (1920x1080, 30fps, 300 frames)"
        const match = line.match(/(\w+)\s*\((\d+)x(\d+),\s*(\d+)fps,\s*(\d+)\s*frames?\)/);
        if (match) {
          compositionInfo = {
            id: match[1],
            width: parseInt(match[2], 10),
            height: parseInt(match[3], 10),
            fps: parseInt(match[4], 10),
            durationInFrames: parseInt(match[5], 10),
          };
          break;
        }
      }
    }

    if (!compositionInfo) {
      return {
        content: [
          {
            type: 'text',
            text: `Composition "${compositionId}" not found. Available compositions:\n${result.stdout}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(compositionInfo, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: `Failed to get composition info: ${errorMessage}`,
        },
      ],
    };
  }
}
