import { execFile } from 'child_process';
import { join } from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export const renderStillTool = {
  name: 'renderStill',
  description: 'Render a still frame at a specific time as a PNG image. Use this to verify visual output.',
  input_schema: {
    type: 'object' as const,
    properties: {
      frame: {
        type: 'number',
        description: 'The frame number to render',
      },
      compositionId: {
        type: 'string',
        description: 'The composition ID to render (default: "MainComposition")',
      },
    },
    required: ['frame'],
  },
  async execute(input: { frame: number; compositionId?: string }): Promise<string> {
    const compositionId = input.compositionId || 'MainComposition';
    const outputPath = join('/workspace', '.build', `still-${input.frame}.png`);

    try {
      await execFileAsync('npx', [
        'remotion', 'still',
        `--composition=${compositionId}`,
        `--frame=${input.frame}`,
        `--output=${outputPath}`,
        '--cwd=/workspace',
      ], {
        timeout: 60_000,
        cwd: '/workspace',
      });

      return `Still rendered at frame ${input.frame}: ${outputPath}`;
    } catch (err: any) {
      return `Failed to render still: ${err.message}`;
    }
  },
};
