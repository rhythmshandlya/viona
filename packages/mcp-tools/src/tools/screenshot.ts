import { execa } from 'execa';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

const REMOTION_PROJECT_DIR = process.env.REMOTION_PROJECT_DIR || 'C:/Users/armaa/test';

export const screenshotTool = {
  name: 'screenshot',
  description: 'Capture a screenshot of a Remotion composition at a specific frame. Returns the image as base64 for visual evaluation.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      compositionId: {
        type: 'string',
        description: 'The ID of the Remotion composition to screenshot',
      },
      frame: {
        type: 'number',
        description: 'The frame number to capture (0-indexed)',
      },
    },
    required: ['compositionId', 'frame'],
  },
};

export async function handleScreenshot(args: unknown): Promise<{
  content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
}> {
  const { compositionId, frame } = args as { compositionId: string; frame: number };

  const outputPath = join(tmpdir(), `screenshot-${randomUUID()}.png`);
  const entryPoint = join(REMOTION_PROJECT_DIR, 'src/index.ts');

  try {
    // Run remotion still command
    await execa('npx', [
      'remotion',
      'still',
      entryPoint,
      compositionId,
      outputPath,
      `--frame=${frame}`,
    ], {
      cwd: REMOTION_PROJECT_DIR,
      timeout: 60000,
    });

    // Read the image and convert to base64
    const imageBuffer = await readFile(outputPath);
    const base64Image = imageBuffer.toString('base64');

    return {
      content: [
        {
          type: 'image',
          data: base64Image,
          mimeType: 'image/png',
        },
        {
          type: 'text',
          text: `Screenshot captured: ${compositionId} at frame ${frame}`,
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: `Failed to capture screenshot: ${errorMessage}`,
        },
      ],
    };
  }
}
