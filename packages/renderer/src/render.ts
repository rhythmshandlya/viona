import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { copyFileSync, existsSync } from 'fs';
import { VideoCompositionProps, SubtitleItem } from './components/VideoComposition';
import { SubtitleStyle } from './components/AnimatedSubtitle';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface RenderOptions {
  videoUrl: string;
  subtitles: SubtitleItem[];
  outputPath: string;
  width?: number;
  height?: number;
  fps?: number;
  durationMs: number;
  defaultSubtitleStyle?: SubtitleStyle;
  onProgress?: (progress: number) => void;
}

let bundleLocation: string | null = null;

async function getBundleLocation(): Promise<string> {
  if (bundleLocation) {
    return bundleLocation;
  }

  console.log('Bundling Remotion composition...');

  // Path to the remotion-entry.tsx file (relative to package root, since __dirname is dist/ after compilation)
  const entryPoint = join(__dirname, '..', 'src', 'remotion-entry.tsx');

  bundleLocation = await bundle({
    entryPoint,
    // Use webpack for better compatibility
    webpackOverride: (config) => config,
  });

  console.log('Bundle created at:', bundleLocation);
  return bundleLocation;
}

export async function renderVideo(options: RenderOptions): Promise<void> {
  const {
    videoUrl,
    subtitles,
    outputPath,
    width = 1920,
    height = 1080,
    fps = 30,
    durationMs,
    defaultSubtitleStyle,
    onProgress,
  } = options;

  // Get or create bundle
  const bundlePath = await getBundleLocation();

  // Calculate duration in frames
  const durationInFrames = Math.ceil((durationMs / 1000) * fps);

  // Copy the video file into the bundle directory so Remotion's dev server
  // can serve it via HTTP. Absolute paths don't work (they get concatenated
  // with the bundle root) and file:// URLs are rejected by Remotion.
  let resolvedVideoUrl = videoUrl;
  if (videoUrl.startsWith('/') && existsSync(videoUrl)) {
    const videoFileName = basename(videoUrl);
    const destPath = join(bundlePath, videoFileName);
    if (!existsSync(destPath)) {
      copyFileSync(videoUrl, destPath);
    }
    resolvedVideoUrl = videoFileName;
  }

  const inputProps = {
    videoUrl: resolvedVideoUrl,
    subtitles,
    defaultSubtitleStyle,
  } as Record<string, unknown>;

  console.log('Selecting composition...');

  // Select the composition
  const composition = await selectComposition({
    serveUrl: bundlePath,
    id: 'VionaVideo',
    inputProps,
  });

  // Override composition settings (keep full resolution — font sizes are CSS pixels)
  const finalComposition = {
    ...composition,
    width,
    height,
    fps,
    durationInFrames,
  };

  console.log('Starting render...');
  console.log(`  Duration: ${durationMs}ms (${durationInFrames} frames)`);
  console.log(`  Resolution: ${width}x${height}`);
  console.log(`  FPS: ${fps}`);
  console.log(`  Subtitles: ${subtitles.length}`);

  // Render the video
  // Use memory-efficient settings for production (Docker/Railway with limited RAM)
  await renderMedia({
    composition: finalComposition,
    serveUrl: bundlePath,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps,
    // Memory-saving settings for constrained environments
    concurrency: 1,
    imageFormat: 'jpeg',
    jpegQuality: 85,
    x264Preset: 'ultrafast',
    crf: 23,
    chromiumOptions: {
      enableMultiProcessOnLinux: true,
    },
    offthreadVideoCacheSizeInBytes: 50 * 1024 * 1024, // 50MB video cache limit
    // Limit FFmpeg threads to prevent OOM on Railway (default auto-detects 60+ threads)
    ffmpegOverride: ({ args }) => {
      // Insert -threads 4 before the output file (last arg)
      const outputFile = args[args.length - 1];
      return [...args.slice(0, -1), '-threads', '4', outputFile];
    },
    onProgress: ({ progress }) => {
      const percent = Math.round(progress * 100);
      if (onProgress) {
        onProgress(percent);
      }
    },
  });

  console.log('Render complete:', outputPath);
}

// Re-export types
export type { SubtitleItem, VideoCompositionProps } from './components/VideoComposition';
export type { SubtitleWord, SubtitleStyle } from './components/AnimatedSubtitle';
