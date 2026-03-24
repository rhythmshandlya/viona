import { execFile } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const WORKSPACE = process.env.WORKSPACE_DIR || '/workspace';
const MAX_CONCURRENT_RENDERS = 2;

let activeRenders = 0;
const renderQueue: Array<{ resolve: () => void }> = [];

async function acquireRenderSlot(): Promise<void> {
  if (activeRenders < MAX_CONCURRENT_RENDERS) {
    activeRenders++;
    return;
  }
  return new Promise<void>((resolve) => {
    renderQueue.push({ resolve });
  });
}

function releaseRenderSlot(): void {
  activeRenders--;
  const next = renderQueue.shift();
  if (next) {
    activeRenders++;
    next.resolve();
  }
}

/**
 * Write a render-props.json file that includes the manifest.
 * Remotion's --props flag reads this file, bypassing calculateMetadata's
 * broken staticFile() fetch in headless CLI mode.
 */
function writeRenderProps(): string {
  const propsPath = join(WORKSPACE, '.build', 'render-props.json');
  mkdirSync(join(WORKSPACE, '.build'), { recursive: true });
  const manifestRaw = readFileSync(join(WORKSPACE, 'manifest.json'), 'utf-8');
  const manifest = JSON.parse(manifestRaw);
  writeFileSync(propsPath, JSON.stringify({ manifest }));
  return propsPath;
}

export const renderStillTool = {
  name: 'render_still',
  description: 'Render a still frame at a specific time as a PNG image. Use this to verify visual output. Max 2 concurrent renders.',
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
    const outputPath = join(WORKSPACE, '.build', `still-${input.frame}.png`);

    await acquireRenderSlot();
    try {
      let propsPath: string;
      try {
        propsPath = writeRenderProps();
      } catch (propsErr: any) {
        return `Cannot render: manifest.json not found or invalid. Ensure the manifest exists before rendering. (${propsErr.message})`;
      }

      const isLinux = process.platform === 'linux';
      const args = [
        'remotion', 'still',
        'src/Root.tsx',
        compositionId,
        outputPath,
        `--frame=${input.frame}`,
        `--props=${propsPath}`,
        ...(isLinux ? ['--gl=swangle'] : []),
      ];

      await execFileAsync('npx', args, {
        timeout: 90_000,
        cwd: WORKSPACE,
      });

      return `Still rendered at frame ${input.frame}: ${outputPath}`;
    } catch (err: any) {
      const output = (err.stdout || '') + (err.stderr || '');
      return `Failed to render still: ${err.message}\n${output.slice(0, 1000)}`;
    } finally {
      releaseRenderSlot();
    }
  },
};
