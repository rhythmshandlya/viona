import {
  renderMediaOnLambda,
  getRenderProgress,
  AwsRegion,
} from '@remotion/lambda/client';
import { logger } from '../logger.js';

// Lambda configuration from environment
const REMOTION_AWS_REGION = (process.env.REMOTION_AWS_REGION || 'us-east-1') as AwsRegion;
const REMOTION_FUNCTION_NAME = process.env.REMOTION_FUNCTION_NAME || '';
const REMOTION_SERVE_URL = process.env.REMOTION_SERVE_URL || ''; // S3 URL to bundled site

export interface LambdaRenderOptions {
  compositionId: string;
  inputProps?: Record<string, unknown>;
  outName?: string;
  onProgress?: (progress: number) => void;
}

export interface LambdaRenderResult {
  outputUrl: string;
  bucketName: string;
  renderId: string;
}

/**
 * Check if Lambda rendering is configured
 */
export function isLambdaConfigured(): boolean {
  return !!(REMOTION_FUNCTION_NAME && REMOTION_SERVE_URL);
}

/**
 * Render video using Remotion Lambda (massively parallel)
 *
 * Requirements:
 * - AWS credentials configured (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
 * - Remotion Lambda function deployed
 * - Site bundled and uploaded to S3
 */
export async function renderWithLambda(options: LambdaRenderOptions): Promise<LambdaRenderResult> {
  const { compositionId, inputProps = {}, outName, onProgress } = options;

  if (!isLambdaConfigured()) {
    throw new Error('Remotion Lambda not configured. Set REMOTION_FUNCTION_NAME and REMOTION_SERVE_URL');
  }

  logger.info({
    compositionId,
    functionName: REMOTION_FUNCTION_NAME,
    region: REMOTION_AWS_REGION,
  }, 'Starting Remotion Lambda render');

  // Start the render
  const { bucketName, renderId } = await renderMediaOnLambda({
    region: REMOTION_AWS_REGION,
    functionName: REMOTION_FUNCTION_NAME,
    serveUrl: REMOTION_SERVE_URL,
    composition: compositionId,
    inputProps,
    codec: 'h264',
    imageFormat: 'png',
    maxRetries: 1,
    framesPerLambda: 20, // Each Lambda renders 20 frames
    privacy: 'private',
    outName: outName || `render-${Date.now()}.mp4`,
  });

  logger.info({ renderId, bucketName }, 'Lambda render started');

  // Poll for progress
  let outputUrl = '';
  while (true) {
    const progress = await getRenderProgress({
      renderId,
      bucketName,
      functionName: REMOTION_FUNCTION_NAME,
      region: REMOTION_AWS_REGION,
    });

    if (progress.fatalErrorEncountered) {
      throw new Error(`Lambda render failed: ${progress.errors?.[0]?.message || 'Unknown error'}`);
    }

    if (progress.done && progress.outputFile) {
      outputUrl = progress.outputFile;
      logger.info({ renderId, outputUrl }, 'Lambda render complete');
      break;
    }

    // Report progress
    const percent = progress.overallProgress;
    if (onProgress && percent !== undefined) {
      onProgress(percent);
    }

    logger.debug({
      renderId,
      progress: Math.round((percent || 0) * 100),
      framesRendered: progress.framesRendered,
      chunks: progress.chunks,
    }, 'Lambda render progress');

    // Wait before polling again
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return {
    outputUrl,
    bucketName,
    renderId,
  };
}

/**
 * Download rendered video from S3 to local path
 */
export async function downloadLambdaOutput(
  outputUrl: string,
  localPath: string
): Promise<void> {
  const { writeFile } = await import('fs/promises');

  logger.info({ outputUrl, localPath }, 'Downloading Lambda output');

  const response = await fetch(outputUrl);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(localPath, buffer);

  logger.info({ localPath, size: buffer.length }, 'Lambda output downloaded');
}
