/**
 * SVG Animation Processor
 *
 * Converts user-uploaded images to animated SVG compositions:
 * 1. Download image from S3
 * 2. Convert to SVG using Claude Vision API
 * 3. Generate animated Remotion composition using Claude Code
 * 4. Bundle and upload to S3
 * 5. Create visual record and timeline item
 */

import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { mkdir, rm, writeFile, readFile, readdir } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { spawn, execSync } from 'child_process';
import OpenAI from 'openai';
import { db, projects, tracks, timelineItems, jobs, visuals } from '../db/index.js';
import { publishJobProgress, publishJobComplete, publishJobError } from '../services/redis.js';
import { downloadFile, uploadFile } from '../services/minio.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { getWorkspacePath, createProjectDir } from '../workspace.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface SvgAnimationJobData {
  projectId: string;
  jobId: string;
  imageKey: string;
  animationType: 'draw' | 'motion';
  animationStyle: 'elegant' | 'playful' | 'minimal';
  durationSeconds: number;
  trackId: string | null;
  startMs: number;
  width: number;
  height: number;
}

interface SvgAnimationMetadata {
  compositionId: string;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
}

/**
 * Upload bundle directory to S3 storage.
 */
async function uploadBundleToStorage(bundleDir: string, compositionId: string): Promise<void> {
  const files = await readdir(bundleDir, { recursive: true, withFileTypes: true });

  for (const file of files) {
    if (file.isFile()) {
      const parentPath = file.parentPath || file.path;
      const relativePath = parentPath.replace(bundleDir, '').replace(/^[\\/]/, '');
      const fileName = file.name;
      const relativeFilePath = relativePath ? `${relativePath}/${fileName}` : fileName;

      const s3Key = `bundles/${compositionId}/${relativeFilePath}`.replace(/\\/g, '/');
      const localPath = join(parentPath, fileName);

      await uploadFile('outputs', s3Key, localPath);
    }
  }

  logger.info({ compositionId, bundleDir }, 'Bundle uploaded to S3');
}

/**
 * Upload source project directory to S3 storage.
 */
async function uploadSourceToStorage(projectDir: string, compositionId: string): Promise<string> {
  const files = await readdir(projectDir, { recursive: true, withFileTypes: true });

  for (const file of files) {
    if (file.isFile()) {
      const parentPath = file.parentPath || file.path;
      const relativePath = parentPath.replace(projectDir, '').replace(/^[\\/]/, '');
      const fileName = file.name;
      const relativeFilePath = relativePath ? `${relativePath}/${fileName}` : fileName;

      const s3Key = `sources/${compositionId}/${relativeFilePath}`.replace(/\\/g, '/');
      const localPath = join(parentPath, fileName);

      await uploadFile('outputs', s3Key, localPath);
    }
  }

  const sourceUrl = `/api/sources/${compositionId}`;
  logger.info({ compositionId, projectDir, sourceUrl }, 'Source project files uploaded to S3');
  return sourceUrl;
}

/**
 * Convert image to SVG using OpenAI Vision API
 */
async function convertImageToSvg(
  imagePath: string,
  width: number,
  height: number,
  animationType: 'draw' | 'motion'
): Promise<string> {
  const openai = new OpenAI({
    apiKey: config.transcription.openaiApiKey,
  });

  // Read image as base64
  const imageBuffer = await readFile(imagePath);
  const imageBase64 = imageBuffer.toString('base64');

  // Determine media type from file extension
  const ext = imagePath.split('.').pop()?.toLowerCase() || 'png';
  const mediaTypeMap: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
  };
  const mediaType = mediaTypeMap[ext] || 'image/png';

  const animationHint = animationType === 'draw'
    ? 'The SVG will be used for a stroke-drawing animation, so use path elements with well-defined strokes.'
    : 'The SVG will be used for motion animations (scale, translate, rotate, fade), so group related elements logically.';

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 8192,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: {
            url: `data:${mediaType};base64,${imageBase64}`,
          },
        },
        {
          type: 'text',
          text: `Convert this image to clean, optimized SVG code for animation.

Requirements:
- Use path elements with clear strokes (for draw animations)
- Group related elements with <g> tags and meaningful IDs
- Add meaningful IDs to all animatable elements (e.g., id="main-shape", id="accent-line-1")
- Use viewBox proportional to ${width}x${height}
- Keep the SVG clean and optimized - remove unnecessary attributes
- Use currentColor or explicit colors that can be easily modified
- ${animationHint}

Return ONLY the SVG code, nothing else. No explanations, no markdown code blocks - just the raw SVG starting with <svg and ending with </svg>.`,
        },
      ],
    }],
  });

  // Extract SVG from response
  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No SVG content in OpenAI Vision response');
  }

  let svg = content.trim();

  // Clean up response - remove markdown code blocks if present
  if (svg.startsWith('```')) {
    svg = svg.replace(/^```(?:svg|xml)?\n?/, '').replace(/\n?```$/, '');
  }

  // Validate it's actually SVG
  if (!svg.startsWith('<svg') || !svg.includes('</svg>')) {
    throw new Error('Invalid SVG response from OpenAI Vision');
  }

  return svg;
}

/**
 * Generate animated Remotion composition from SVG
 */
async function generateAnimatedComposition(
  projectDir: string,
  svg: string,
  options: {
    compositionId: string;
    workspaceCompositionId: string;
    animationType: 'draw' | 'motion';
    animationStyle: 'elegant' | 'playful' | 'minimal';
    durationSeconds: number;
    width: number;
    height: number;
    fps: number;
  }
): Promise<void> {
  const { compositionId, workspaceCompositionId, animationType, animationStyle, durationSeconds, width, height, fps } = options;
  const durationInFrames = durationSeconds * fps;

  // Write SVG to file
  const svgPath = join(projectDir, 'image.svg');
  await writeFile(svgPath, svg, 'utf-8');

  // Style configurations
  const styleConfigs = {
    elegant: {
      springDamping: 30,
      springMass: 1,
      springStiffness: 100,
      easing: 'easeInOutCubic',
    },
    playful: {
      springDamping: 15,
      springMass: 0.8,
      springStiffness: 200,
      easing: 'easeOutBack',
    },
    minimal: {
      springDamping: 40,
      springMass: 1.2,
      springStiffness: 80,
      easing: 'easeInOutQuad',
    },
  };

  const styleConfig = styleConfigs[animationStyle];

  // Generate metadata.json
  const metadata: SvgAnimationMetadata = {
    compositionId,
    durationInFrames,
    fps,
    width,
    height,
  };
  await writeFile(join(projectDir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf-8');

  // Generate index.tsx (main composition export)
  const indexContent = generateIndexTsx(compositionId, animationType, styleConfig, durationInFrames, width, height, fps);
  await writeFile(join(projectDir, 'index.tsx'), indexContent, 'utf-8');

  // Generate SvgAnimation.tsx component
  const componentContent = generateSvgAnimationComponent(svg, animationType, styleConfig, durationInFrames);
  await writeFile(join(projectDir, 'SvgAnimation.tsx'), componentContent, 'utf-8');

  // Update workspace Root.tsx to include this composition
  const workspacePath = getWorkspacePath();
  await updateRootTsx(workspacePath, compositionId, workspaceCompositionId, durationInFrames, fps, width, height);

  logger.info({ projectDir, animationType, animationStyle }, 'Generated animated composition files');
}

/**
 * Update workspace Root.tsx to include the new SVG animation composition
 */
async function updateRootTsx(
  workspacePath: string,
  compositionId: string,
  workspaceCompositionId: string,
  durationInFrames: number,
  fps: number,
  width: number,
  height: number
): Promise<void> {
  const rootPath = join(workspacePath, 'src', 'Root.tsx');

  const rootContent = `/**
 * Remotion Root component for SVG Animation.
 */

import "./index.css";
import { Composition } from "remotion";
import MainComposition from "./${workspaceCompositionId}";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="${compositionId}"
        component={MainComposition}
        durationInFrames={${durationInFrames}}
        fps={${fps}}
        width={${width}}
        height={${height}}
      />
    </>
  );
};
`;

  await writeFile(rootPath, rootContent, 'utf-8');
  logger.info({ rootPath, compositionId }, 'Updated Root.tsx with SVG animation composition');
}

/**
 * Generate index.tsx file content
 */
function generateIndexTsx(
  compositionId: string,
  animationType: string,
  styleConfig: any,
  durationInFrames: number,
  width: number,
  height: number,
  fps: number
): string {
  return `import { Composition } from 'remotion';
import { SvgAnimation } from './SvgAnimation';

export const ${compositionId.replace(/-/g, '_')} = () => {
  return (
    <>
      <Composition
        id="${compositionId}"
        component={SvgAnimation}
        durationInFrames={${durationInFrames}}
        fps={${fps}}
        width={${width}}
        height={${height}}
        defaultProps={{
          animationType: '${animationType}',
          springConfig: {
            damping: ${styleConfig.springDamping},
            mass: ${styleConfig.springMass},
            stiffness: ${styleConfig.springStiffness},
          },
        }}
      />
    </>
  );
};

export default ${compositionId.replace(/-/g, '_')};
`;
}

/**
 * Generate SvgAnimation.tsx component with draw or motion animation
 */
function generateSvgAnimationComponent(
  svg: string,
  animationType: 'draw' | 'motion',
  styleConfig: any,
  durationInFrames: number
): string {
  // Escape backticks and template literals in SVG for embedding in template string
  const escapedSvg = svg
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\${/g, '\\${');

  if (animationType === 'draw') {
    return generateDrawAnimationComponent(escapedSvg, styleConfig, durationInFrames);
  } else {
    return generateMotionAnimationComponent(escapedSvg, styleConfig, durationInFrames);
  }
}

/**
 * Generate draw/reveal animation component
 */
function generateDrawAnimationComponent(
  escapedSvg: string,
  styleConfig: any,
  durationInFrames: number
): string {
  return `import React, { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate, Easing } from 'remotion';

interface Props {
  animationType: string;
  springConfig: {
    damping: number;
    mass: number;
    stiffness: number;
  };
}

export const SvgAnimation: React.FC<Props> = ({ springConfig }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Calculate draw progress using spring animation
  const drawProgress = spring({
    frame,
    fps,
    config: {
      damping: springConfig.damping,
      mass: springConfig.mass,
      stiffness: springConfig.stiffness,
    },
    durationInFrames: Math.floor(durationInFrames * 0.8),
  });

  // Fade in at the start
  const opacity = interpolate(frame, [0, fps * 0.3], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // SVG content
  const svgContent = \`${escapedSvg}\`;

  // Parse SVG and inject animation styles
  const animatedSvg = useMemo(() => {
    // Add stroke-dasharray animation to all paths
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, 'image/svg+xml');
    const paths = doc.querySelectorAll('path, line, polyline, polygon, circle, ellipse, rect');

    paths.forEach((path, index) => {
      const el = path as SVGGeometryElement;
      try {
        const length = el.getTotalLength ? el.getTotalLength() : 1000;
        el.style.strokeDasharray = String(length);
        el.style.strokeDashoffset = String(length * (1 - drawProgress));
        // Stagger the animation slightly for each path
        const staggerDelay = index * 0.05;
        const staggeredProgress = Math.max(0, drawProgress - staggerDelay) / (1 - staggerDelay);
        el.style.strokeDashoffset = String(length * (1 - Math.min(1, staggeredProgress)));
      } catch {
        // Element doesn't support getTotalLength
      }
    });

    return new XMLSerializer().serializeToString(doc);
  }, [drawProgress, svgContent]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
        opacity,
      }}
      dangerouslySetInnerHTML={{ __html: animatedSvg }}
    />
  );
};
`;
}

/**
 * Generate motion animation component
 */
function generateMotionAnimationComponent(
  escapedSvg: string,
  styleConfig: any,
  durationInFrames: number
): string {
  return `import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

interface Props {
  animationType: string;
  springConfig: {
    damping: number;
    mass: number;
    stiffness: number;
  };
}

export const SvgAnimation: React.FC<Props> = ({ springConfig }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Scale animation
  const scale = spring({
    frame,
    fps,
    config: {
      damping: springConfig.damping,
      mass: springConfig.mass,
      stiffness: springConfig.stiffness,
    },
    durationInFrames: Math.floor(durationInFrames * 0.5),
  });

  // Fade in
  const opacity = interpolate(frame, [0, fps * 0.3], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Subtle rotation for playfulness
  const rotation = interpolate(
    frame,
    [0, Math.floor(durationInFrames * 0.3)],
    [-5, 0],
    { extrapolateRight: 'clamp' }
  );

  // Translate Y for entrance effect
  const translateY = interpolate(
    frame,
    [0, Math.floor(durationInFrames * 0.4)],
    [50, 0],
    { extrapolateRight: 'clamp' }
  );

  // SVG content
  const svgContent = \`${escapedSvg}\`;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
      }}
    >
      <div
        style={{
          opacity,
          transform: \`scale(\${scale}) rotate(\${rotation}deg) translateY(\${translateY}px)\`,
          transformOrigin: 'center center',
        }}
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    </div>
  );
};
`;
}

/**
 * Compile composition to CJS for dynamic frontend loading
 */
async function compileCjs(projectDir: string, bundleDir: string): Promise<void> {
  const indexTsx = join(projectDir, 'index.tsx');
  const cjsOutput = join(bundleDir, 'composition.cjs.js');
  const workspacePath = getWorkspacePath();

  logger.info({ indexTsx, cjsOutput }, 'Compiling composition to CJS');

  try {
    execSync([
      'npx', 'esbuild',
      indexTsx,
      '--bundle',
      '--format=cjs',
      '--platform=browser',
      '--target=es2020',
      '--external:react',
      '--external:react/jsx-runtime',
      '--external:react/jsx-dev-runtime',
      '--external:remotion',
      '--external:@remotion/noise',
      '--external:@remotion/shapes',
      '--external:@remotion/paths',
      '--external:@remotion/three',
      `--outfile=${cjsOutput}`,
    ].join(' '), {
      cwd: workspacePath,
      timeout: 60000,
      encoding: 'utf-8',
    });
    logger.info({ cjsOutput }, 'CJS compilation complete');
  } catch (error) {
    logger.error({ error }, 'CJS compilation failed');
    throw new Error(`Failed to compile composition to CJS: ${error}`);
  }
}

/**
 * Bundle the Remotion project
 */
async function bundleComposition(
  compositionId: string,
  bundleOutputDir: string
): Promise<string> {
  const workspacePath = getWorkspacePath();
  const bundleDir = join(bundleOutputDir, compositionId);

  // Create bundle directory
  if (!existsSync(bundleDir)) {
    mkdirSync(bundleDir, { recursive: true });
  }

  logger.info({ compositionId, bundleDir }, 'Bundling composition');

  // Use src/index.ts as entry point (it calls registerRoot with Root.tsx)
  const entryPoint = 'src/index.ts';

  return new Promise((resolve, reject) => {
    const bundle = spawn(
      'npx',
      ['remotion', 'bundle', entryPoint, '--out-dir', bundleDir],
      {
        cwd: workspacePath,
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    let stdout = '';
    let stderr = '';

    bundle.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    bundle.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    bundle.on('close', (code) => {
      if (code === 0) {
        logger.info({ compositionId, bundleDir }, 'Bundle complete');
        resolve(bundleDir);
      } else {
        logger.error({ compositionId, code, stderr }, 'Bundle failed');
        reject(new Error(`Bundle failed with code ${code}: ${stderr}`));
      }
    });

    bundle.on('error', (error) => {
      reject(new Error(`Bundle process error: ${error.message}`));
    });
  });
}

export async function processSvgAnimationJob(job: Job<SvgAnimationJobData>) {
  const {
    projectId,
    jobId,
    imageKey,
    animationType,
    animationStyle,
    durationSeconds,
    trackId,
    startMs,
    width,
    height,
  } = job.data;

  const fps = 30;
  const durationMs = durationSeconds * 1000;
  const compositionId = `svg-anim-${jobId.slice(0, 8)}`;
  const workspaceCompositionId = compositionId.replace(/-/g, '_');

  try {
    // Update job status
    await db.update(jobs)
      .set({ status: 'processing', progress: 0 })
      .where(eq(jobs.id, jobId));

    await publishJobProgress(jobId, 5, 'Downloading image...');

    // Download image from S3
    const imagePath = join(tmpdir(), `svg-anim-${jobId}-image.${imageKey.split('.').pop()}`);
    await downloadFile('uploads', imageKey, imagePath);

    logger.info({ projectId, jobId, imagePath }, 'Image downloaded');

    await publishJobProgress(jobId, 15, 'Converting image to SVG...');

    // Convert image to SVG using Claude Vision
    const svg = await convertImageToSvg(imagePath, width, height, animationType);

    logger.info({ projectId, jobId, svgLength: svg.length }, 'SVG generated from image');

    await publishJobProgress(jobId, 40, 'Generating animated composition...');

    // Create project directory in workspace
    const workspacePath = getWorkspacePath();
    const projectDir = createProjectDir(workspaceCompositionId);

    // Generate animated Remotion composition
    await generateAnimatedComposition(projectDir, svg, {
      compositionId,
      workspaceCompositionId,
      animationType,
      animationStyle,
      durationSeconds,
      width,
      height,
      fps,
    });

    await publishJobProgress(jobId, 60, 'Bundling composition...');

    // Bundle the composition
    const bundleDir = await bundleComposition(
      compositionId,
      config.remotion.bundleOutputDir
    );

    await publishJobProgress(jobId, 70, 'Compiling for preview...');

    // Compile to CJS for frontend dynamic loading
    await compileCjs(projectDir, bundleDir);

    await publishJobProgress(jobId, 80, 'Uploading to storage...');

    // Upload bundle to S3
    await uploadBundleToStorage(bundleDir, compositionId);

    // Upload source files to S3
    const sourceUrl = await uploadSourceToStorage(projectDir, compositionId);

    await publishJobProgress(jobId, 85, 'Creating timeline item...');

    // Bundle URL
    const bundleUrl = `/api/bundles/${compositionId}/index.html`;

    // Create or get the target track
    let targetTrackId = trackId;
    if (!targetTrackId) {
      // Create a new "Animations" track
      const existingTracks = await db.select().from(tracks).where(eq(tracks.projectId, projectId));
      const [newTrack] = await db.insert(tracks).values({
        projectId,
        type: 'visual',
        name: 'Animations',
        position: existingTracks.length,
      }).returning();
      targetTrackId = newTrack.id;
    }

    // Create visual record
    const [insertedVisual] = await db.insert(visuals).values({
      projectId,
      compositionId,
      bundleUrl,
      sourceUrl,
      durationFrames: durationSeconds * fps,
      fps,
      width,
      height,
      stylePreset: animationStyle,
      llmModel: 'gpt-4o',
      timestamps: [{
        startMs,
        endMs: startMs + durationMs,
        type: animationType === 'draw' ? 'svg-draw' : 'svg-motion',
        description: `SVG ${animationType} animation`,
      }],
    }).returning({ id: visuals.id });

    // Create timeline item
    await db.insert(timelineItems).values({
      trackId: targetTrackId,
      type: 'visual',
      startMs,
      endMs: startMs + durationMs,
      data: {
        visualId: insertedVisual.id,
        compositionId,
        bundleUrl,
        type: `svg-${animationType}`,
        description: `SVG ${animationType} animation`,
        width,
        height,
        fps,
      },
    });

    await publishJobProgress(jobId, 95, 'Finalizing...');

    // Update job status
    await db.update(jobs)
      .set({
        status: 'complete',
        progress: 100,
        completedAt: new Date(),
        metrics: {
          durationMs: durationMs,
          filesWritten: 3,
          llmModel: 'gpt-4o',
        },
      })
      .where(eq(jobs.id, jobId));

    // Reset project status to ready
    await db.update(projects)
      .set({ status: 'ready', updatedAt: new Date() })
      .where(eq(projects.id, projectId));

    await publishJobProgress(jobId, 100, 'Complete');
    await publishJobComplete(jobId, projectId);

    // Cleanup temp image
    try {
      await rm(imagePath);
    } catch {
      // Ignore cleanup errors
    }

    logger.info({ projectId, jobId, compositionId }, 'SVG animation job complete');

  } catch (error) {
    logger.error({ projectId, jobId, err: error }, 'SVG animation job failed');

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await db.update(jobs)
      .set({ status: 'failed', error: errorMessage })
      .where(eq(jobs.id, jobId));

    await db.update(projects)
      .set({ status: 'failed' })
      .where(eq(projects.id, projectId));

    await publishJobError(jobId, errorMessage);

    throw error;
  }
}
