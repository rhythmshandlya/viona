import { execFile } from 'child_process';
import { readFile } from 'fs/promises';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const WORKSPACE = process.env.WORKSPACE_DIR || '/workspace';
const MANIFEST_PATH = join(WORKSPACE, 'manifest.json');

/** Write render-props.json with manifest for --props flag (bypasses broken calculateMetadata). */
function writeRenderProps(): string {
  const propsPath = join(WORKSPACE, '.build', 'render-props.json');
  mkdirSync(join(WORKSPACE, '.build'), { recursive: true });
  const manifestRaw = readFileSync(MANIFEST_PATH, 'utf-8');
  const manifest = JSON.parse(manifestRaw);
  writeFileSync(propsPath, JSON.stringify({ manifest }));
  return propsPath;
}

interface SceneRenderResult {
  sceneFile: string;
  frame: number;
  pass: boolean;
  error?: string;
}

interface ValidationResult {
  tsc: { pass: boolean; errors?: string };
  render: { pass: boolean; error?: string; sceneResults?: SceneRenderResult[] };
  schema: { pass: boolean; issues?: string[] };
}

export const validateWorkspaceTool = {
  name: 'validate_workspace',
  description:
    'Run a full workspace validation: TypeScript compilation (tsc --noEmit), ' +
    'test render of a frame from EACH scene (remotion still — catches runtime errors ' +
    'like reversed interpolate inputRange), and manifest schema validation. ' +
    'Call this BEFORE reporting "done" to ensure the workspace is in a working state.',
  input_schema: {
    type: 'object' as const,
    properties: {
      renderFrame: {
        type: 'number',
        description: 'Frame number to test render (default: 10)',
      },
    },
    required: [] as string[],
  },
  async execute(input: { renderFrame?: number }): Promise<string> {
    const isLinux = process.platform === 'linux';
    const result: ValidationResult = {
      tsc: { pass: false },
      render: { pass: false },
      schema: { pass: false },
    };

    // 1. TypeScript compilation check
    try {
      await execFileAsync('npx', ['tsc', '--noEmit'], {
        timeout: 60_000,
        cwd: WORKSPACE,
      });
      result.tsc = { pass: true };
    } catch (err: any) {
      const output = (err.stdout || '') + (err.stderr || '');
      result.tsc = { pass: false, errors: output.slice(0, 2000) };
    }

    // 2. Test render — render a frame from EACH scene (catches runtime errors
    //    like reversed interpolate inputRange that only fire in specific scenes)
    try {
      const manifestRaw = await readFile(MANIFEST_PATH, 'utf-8');
      const manifest = JSON.parse(manifestRaw);
      const fps = manifest.fps ?? 30;

      // Collect frames to render: one from the midpoint of each scene item
      const framesToRender: { frame: number; sceneFile: string }[] = [];

      for (const item of (manifest.items ?? [])) {
        if (item.type === 'scene' && typeof item.startMs === 'number' && typeof item.endMs === 'number') {
          const midMs = (item.startMs + item.endMs) / 2;
          const midFrame = Math.round((midMs / 1000) * fps);
          framesToRender.push({
            frame: midFrame,
            sceneFile: item.data?.sceneFile ?? item.id,
          });
        }
      }

      // If no scenes found, fall back to frame 10 (or user-provided frame)
      if (framesToRender.length === 0) {
        framesToRender.push({ frame: input.renderFrame ?? 10, sceneFile: 'fallback' });
      }

      const sceneResults: SceneRenderResult[] = [];
      let allScenesPassed = true;

      // Write props file once for all renders (bypasses broken calculateMetadata)
      const propsPath = writeRenderProps();

      for (const { frame, sceneFile } of framesToRender) {
        try {
          const outputPath = join(WORKSPACE, '.build', `validate-still-${frame}.png`);
          await execFileAsync('npx', [
            'remotion', 'still',
            'src/Root.tsx',
            'MainComposition',
            outputPath,
            `--frame=${frame}`,
            `--props=${propsPath}`,
            ...(isLinux ? ['--gl=swangle'] : []),
          ], {
            timeout: 90_000,
            cwd: WORKSPACE,
          });
          sceneResults.push({ sceneFile, frame, pass: true });
        } catch (err: any) {
          allScenesPassed = false;
          const output = (err.stdout || '') + (err.stderr || '');
          sceneResults.push({ sceneFile, frame, pass: false, error: output.slice(0, 2000) });
        }
      }

      result.render = allScenesPassed
        ? { pass: true, sceneResults }
        : { pass: false, error: `${sceneResults.filter(r => !r.pass).length}/${sceneResults.length} scene renders failed`, sceneResults };
    } catch (err: any) {
      // Manifest read failed — fall back to single-frame render
      const frame = input.renderFrame ?? 10;
      try {
        const outputPath = join(WORKSPACE, '.build', `validate-still-${frame}.png`);
        // Try to write props file; if manifest is unreadable, render without props
        let extraArgs: string[] = [];
        try { extraArgs = [`--props=${writeRenderProps()}`]; } catch {}
        await execFileAsync('npx', [
          'remotion', 'still',
          'src/Root.tsx',
          'MainComposition',
          outputPath,
          `--frame=${frame}`,
          ...extraArgs,
          ...(isLinux ? ['--gl=swangle'] : []),
        ], {
          timeout: 90_000,
          cwd: WORKSPACE,
        });
        result.render = { pass: true };
      } catch (renderErr: any) {
        const output = (renderErr.stdout || '') + (renderErr.stderr || '');
        result.render = { pass: false, error: output.slice(0, 2000) };
      }
    }

    // 3. Manifest schema validation
    try {
      const manifestRaw = await readFile(MANIFEST_PATH, 'utf-8');
      const manifest = JSON.parse(manifestRaw);

      const issues: string[] = [];
      if (!manifest.tracks || !Array.isArray(manifest.tracks) || manifest.tracks.length === 0) {
        issues.push('Manifest has no tracks');
      }
      if (!manifest.items || !Array.isArray(manifest.items) || manifest.items.length === 0) {
        issues.push('Manifest has no items');
      }
      if (!manifest.durationMs || manifest.durationMs <= 0) {
        issues.push('Manifest has no valid durationMs');
      }
      if (!manifest.canvas) {
        issues.push('Manifest has no canvas dimensions');
      }

      // Check each item has required fields + structural validation
      for (const item of (manifest.items ?? [])) {
        if (!item.id) issues.push(`Item missing id`);
        if (!item.type) issues.push(`Item ${item.id} missing type`);
        if (!item.trackId) issues.push(`Item ${item.id} missing trackId`);
        if (item.startMs === undefined) issues.push(`Item ${item.id} missing startMs`);
        if (item.endMs === undefined) issues.push(`Item ${item.id} missing endMs`);
        if (!item.data) issues.push(`Item ${item.id} missing data`);

        // Verify trackId references a real track
        const trackExists = (manifest.tracks ?? []).some((t: any) => t.id === item.trackId);
        if (!trackExists) issues.push(`Item ${item.id} references non-existent track ${item.trackId}`);

        // Keyframe structure: must use {timeMs, props} format
        if (item.keyframes && Array.isArray(item.keyframes)) {
          for (let k = 0; k < item.keyframes.length; k++) {
            const kf = item.keyframes[k];
            if (typeof kf.timeMs !== 'number') {
              issues.push(`Item ${item.id} keyframes[${k}] missing or invalid timeMs`);
            }
            if (!kf.props || typeof kf.props !== 'object') {
              const { timeMs, easing, props, ...rest } = kf;
              if (Object.keys(rest).length > 0) {
                issues.push(`Item ${item.id} keyframes[${k}] uses flat format (missing props wrapper)`);
              }
            }
          }
        }

        // Scene items must have displayMode
        if (item.type === 'scene') {
          if (!item.data?.displayMode) issues.push(`Item ${item.id} (scene) missing displayMode`);
          if (item.data?.sceneFile && !item.data.sceneFile.endsWith('.tsx')) {
            issues.push(`Item ${item.id} (scene) sceneFile "${item.data.sceneFile}" missing .tsx extension`);
          }
        }

        // Audio items must have startFrom
        if (item.type === 'audio' && item.data?.startFrom === undefined) {
          issues.push(`Item ${item.id} (audio) missing startFrom`);
        }
      }

      result.schema = issues.length === 0
        ? { pass: true }
        : { pass: false, issues };
    } catch (err: any) {
      result.schema = { pass: false, issues: [`Failed to read/parse manifest: ${err.message}`] };
    }

    const allPass = result.tsc.pass && result.render.pass && result.schema.pass;
    return JSON.stringify({ allPass, ...result }, null, 2);
  },
};
