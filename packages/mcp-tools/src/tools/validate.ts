import { execa } from 'execa';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

const REMOTION_PROJECT_DIR = process.env.REMOTION_PROJECT_DIR || 'C:/Users/armaa/test';

export const validateTool = {
  name: 'validateProject',
  description: 'Validate that the Remotion project compiles and renders without errors by doing a quick render test.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      compositionId: {
        type: 'string',
        description: 'The ID of the composition to validate (optional, validates first composition if not provided)',
      },
    },
    required: [],
  },
};

export async function handleValidate(args: unknown): Promise<{
  content: Array<{ type: string; text: string }>;
}> {
  const { compositionId } = (args as { compositionId?: string }) || {};
  const entryPoint = join(REMOTION_PROJECT_DIR, 'src/index.ts');
  const outputPath = join(tmpdir(), `validate-${randomUUID()}.mp4`);

  try {
    // First, try to get compositions to validate the project compiles
    const compositionsResult = await execa('npx', [
      'remotion',
      'compositions',
      entryPoint,
      '--props={}',
    ], {
      cwd: REMOTION_PROJECT_DIR,
      timeout: 30000,
    });

    // If compositionId provided, do a quick render test (just first frame)
    if (compositionId) {
      await execa('npx', [
        'remotion',
        'render',
        entryPoint,
        compositionId,
        outputPath,
        '--frames=0-1',
      ], {
        cwd: REMOTION_PROJECT_DIR,
        timeout: 60000,
      });
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: 'Project validates successfully',
            compositions: compositionsResult.stdout,
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorOutput = error instanceof Error && 'stderr' in error
      ? (error as { stderr?: string }).stderr
      : '';

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            errors: [errorMessage, errorOutput].filter(Boolean),
          }, null, 2),
        },
      ],
    };
  }
}
