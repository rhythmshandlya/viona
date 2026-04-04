import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { join } from 'path';
import { existsSync, mkdirSync, readFileSync, copyFileSync } from 'fs';

const CHROMIUM_PATH = '/usr/bin/chromium';
const browserExecutable = existsSync(CHROMIUM_PATH) ? CHROMIUM_PATH : null;
const isLinux = process.platform === 'linux';
const chromiumOptions = isLinux ? { gl: 'swangle' as const } : undefined;

/**
 * Render the full composition to an MP4 video file.
 * Uses Remotion's Node.js API (bundle + selectComposition + renderMedia)
 * for proper progress callbacks — no subprocess spawning.
 *
 * Output goes to /workspace/output/final.mp4
 */
export async function renderVideo(options?: {
  compositionId?: string;
  crf?: number;
  concurrency?: number;
  onProgress?: (message: string) => void;
}): Promise<{ outputPath: string; durationMs: number }> {
  const compositionId = options?.compositionId || 'MainComposition';
  const crf = options?.crf ?? 18;
  const concurrency = options?.concurrency ?? 1;
  const outputDir = '/workspace/output';
  const outputPath = join(outputDir, 'final.mp4');

  mkdirSync(outputDir, { recursive: true });

  // Ensure public dir has manifest + media for the bundle
  const publicDir = '/workspace/public';
  mkdirSync(publicDir, { recursive: true });
  if (existsSync('/workspace/manifest.json')) {
    copyFileSync('/workspace/manifest.json', join(publicDir, 'manifest.json'));
  }

  const start = Date.now();

  // Step 1: Bundle
  options?.onProgress?.('Bundling project...');
  const bundleLocation = await bundle({
    entryPoint: join('/workspace', 'src/Root.tsx'),
    webpackOverride: (config) => config,
    publicDir,
  });
  options?.onProgress?.('Bundle ready');

  // Step 2: Read manifest and pass as inputProps to bypass staticFile fetch
  // (Remotion's internal server has issues serving from public/ in some versions)
  const manifest = JSON.parse(readFileSync('/workspace/manifest.json', 'utf-8'));
  const fps = manifest.fps || 30;
  const width = manifest.canvas?.width || 1920;
  const height = manifest.canvas?.height || 1080;
  const durationInFrames = Math.ceil((manifest.durationMs || 5000) / 1000 * fps);

  // Strip assets map for render — assets contain presigned MinIO URLs meant for
  // browser access, but headless Chrome uses staticFile() from the bundled public dir.
  const { assets: _a, ...manifestWithoutAssets } = manifest;
  const inputProps = { manifest: { ...manifestWithoutAssets, assets: {} } };

  options?.onProgress?.('Preparing composition...');
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: compositionId,
    browserExecutable,
    inputProps,
    chromiumOptions,
  });

  // Override with correct values from manifest (calculateMetadata may have failed)
  composition.props = inputProps;
  composition.width = width;
  composition.height = height;
  composition.durationInFrames = durationInFrames;
  composition.fps = fps;

  // Step 3: Render video
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: outputPath,
    crf,
    concurrency,
    imageFormat: 'png',
    x264Preset: 'faster',
    browserExecutable,
    chromiumOptions,
    inputProps,
    onProgress: ({ progress }) => {
      const percent = Math.round(progress * 100);
      options?.onProgress?.(`Rendering frames... ${percent}%`);
    },
  });

  const durationMs = Date.now() - start;
  options?.onProgress?.(`Render complete in ${Math.round(durationMs / 1000)}s`);

  return { outputPath, durationMs };
}
