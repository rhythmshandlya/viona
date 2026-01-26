import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
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

  // Path to the remotion-entry.tsx file
  const entryPoint = join(__dirname, 'remotion-entry.tsx');

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

  // Input props for the composition
  const inputProps = {
    videoUrl,
    subtitles,
    defaultSubtitleStyle,
  } as Record<string, unknown>;

  console.log('Selecting composition...');

  // Select the composition
  const composition = await selectComposition({
    serveUrl: bundlePath,
    id: 'ReelifyVideo',
    inputProps,
  });

  // Override composition settings
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
  await renderMedia({
    composition: finalComposition,
    serveUrl: bundlePath,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps,
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
