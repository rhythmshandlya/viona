import { execFile } from 'child_process';
import { join } from 'path';
import { promisify } from 'util';
import { existsSync, mkdirSync, copyFileSync } from 'fs';

const execFileAsync = promisify(execFile);

/**
 * Render the full composition to an MP4 video file.
 * Uses `npx remotion render` which bundles + renders via Chromium + ffmpeg.
 *
 * Output goes to /workspace/output/final.mp4
 */
export async function renderVideo(options?: {
  compositionId?: string;
  crf?: number;
  concurrency?: number;
  onProgress?: (line: string) => void;
}): Promise<{ outputPath: string; durationMs: number }> {
  const compositionId = options?.compositionId || 'MainComposition';
  const crf = options?.crf ?? 18;
  const concurrency = options?.concurrency ?? 1;
  const outputDir = '/workspace/output';
  const outputPath = join(outputDir, 'final.mp4');

  // Ensure output directory exists
  mkdirSync(outputDir, { recursive: true });

  // Copy manifest.json to public/ so Remotion's staticFile() can access it
  // (calculateMetadata runs in browser context where fs is unavailable)
  const manifestSrc = '/workspace/manifest.json';
  const publicDir = '/workspace/public';
  mkdirSync(publicDir, { recursive: true });
  if (existsSync(manifestSrc)) {
    copyFileSync(manifestSrc, join(publicDir, 'manifest.json'));
  }

  const start = Date.now();

  const args = [
    'remotion', 'render',
    'src/Root.tsx',
    compositionId,
    outputPath,
    `--concurrency=${concurrency}`,
    `--codec=h264`,
    `--crf=${crf}`,
    `--image-format=png`,
    `--x264-preset=faster`,
    '--log=verbose',
  ];

  // Chromium is at /usr/bin/chromium (installed in Dockerfile)
  if (existsSync('/usr/bin/chromium')) {
    args.push('--browser-executable=/usr/bin/chromium');
  }

  const child = execFile('npx', args, {
    cwd: '/workspace',
    timeout: 600_000, // 10 minute max render time
    maxBuffer: 50 * 1024 * 1024, // 50MB buffer for verbose logs
  });

  // Stream stdout/stderr for progress
  if (options?.onProgress) {
    child.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) options.onProgress!(line);
    });
    child.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) options.onProgress!(line);
    });
  }

  await new Promise<void>((resolve, reject) => {
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Remotion render exited with code ${code}`));
    });
    child.on('error', reject);
  });

  const durationMs = Date.now() - start;

  return { outputPath, durationMs };
}
