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
import { db, projects, tracks, timelineItems, jobs, visuals, transcripts } from '../db/index.js';
import { publishJobProgress, publishJobComplete, publishJobError } from '../services/redis.js';
import { downloadFile, uploadFile } from '../services/minio.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { getWorkspacePath, createProjectDir } from '../workspace.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Extract keywords from description to search in transcript.
 * Looks for patterns like "when I say X", "at X", "during X", etc.
 */
function extractSearchKeywords(description: string): string | null {
  if (!description) return null;

  const lowerDesc = description.toLowerCase();

  // Patterns to extract the target phrase
  const patterns = [
    /when\s+(?:i\s+)?(?:say|mention|talk\s+about)\s+["']?([^"']+?)["']?$/i,
    /at\s+["']?([^"']+?)["']?$/i,
    /during\s+["']?([^"']+?)["']?$/i,
    /for\s+["']?([^"']+?)["']?$/i,
    /show\s+(?:this\s+)?(?:when|at|during)\s+["']?([^"']+?)["']?$/i,
    /add\s+(?:this\s+)?(?:when|at|during)\s+["']?([^"']+?)["']?$/i,
  ];

  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  // If no pattern matched, use the whole description as keyword
  return description.trim();
}

/**
 * Search transcript for a phrase and return the timestamp when it starts.
 */
async function findTimestampInTranscript(
  projectId: string,
  searchPhrase: string
): Promise<number | null> {
  try {
    const transcript = await db.query.transcripts.findFirst({
      where: eq(transcripts.projectId, projectId),
    });

    if (!transcript?.words || !Array.isArray(transcript.words)) {
      logger.warn({ projectId }, 'No transcript words found');
      return null;
    }

    const words = transcript.words as Array<{ text: string; startMs: number; endMs: number }>;
    const searchWords = searchPhrase.toLowerCase().split(/\s+/).filter(w => w.length > 0);

    if (searchWords.length === 0) return null;

    // Search for the phrase in the transcript
    for (let i = 0; i <= words.length - searchWords.length; i++) {
      let match = true;
      for (let j = 0; j < searchWords.length; j++) {
        const wordText = words[i + j]?.text?.toLowerCase().replace(/[^\w]/g, '') || '';
        const searchWord = searchWords[j].replace(/[^\w]/g, '');
        if (!wordText.includes(searchWord) && !searchWord.includes(wordText)) {
          match = false;
          break;
        }
      }
      if (match) {
        const startMs = words[i].startMs;
        logger.info({ projectId, searchPhrase, startMs, matchedAt: i }, 'Found phrase in transcript');
        return startMs;
      }
    }

    // If exact phrase not found, try to find individual words
    for (const searchWord of searchWords) {
      const cleanSearchWord = searchWord.replace(/[^\w]/g, '');
      for (const word of words) {
        const wordText = word.text?.toLowerCase().replace(/[^\w]/g, '') || '';
        if (wordText === cleanSearchWord || wordText.includes(cleanSearchWord)) {
          logger.info({ projectId, searchWord, startMs: word.startMs }, 'Found word in transcript');
          return word.startMs;
        }
      }
    }

    logger.warn({ projectId, searchPhrase }, 'Phrase not found in transcript');
    return null;
  } catch (err) {
    logger.error({ projectId, searchPhrase, err }, 'Error searching transcript');
    return null;
  }
}

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
  description?: string;  // Description for scene matching
  sceneId?: number | null;  // Target scene ID for placement
  useOriginalImage?: boolean;  // If true, display original image instead of converting to SVG
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
 * Generate animated Remotion composition that displays the original image
 */
async function generateImageAnimatedComposition(
  projectDir: string,
  imageUrl: string,
  options: {
    compositionId: string;
    workspaceCompositionId: string;
    animationStyle: 'elegant' | 'playful' | 'minimal';
    durationSeconds: number;
    width: number;
    height: number;
    fps: number;
  }
): Promise<void> {
  const { compositionId, workspaceCompositionId, animationStyle, durationSeconds, width, height, fps } = options;
  const durationInFrames = durationSeconds * fps;

  // Style configurations
  const styleConfigs = {
    elegant: {
      springDamping: 30,
      springMass: 1,
      springStiffness: 100,
    },
    playful: {
      springDamping: 15,
      springMass: 0.8,
      springStiffness: 200,
    },
    minimal: {
      springDamping: 40,
      springMass: 1.2,
      springStiffness: 80,
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
  const indexContent = generateImageIndexTsx(compositionId, imageUrl, styleConfig, durationInFrames, width, height, fps);
  await writeFile(join(projectDir, 'index.tsx'), indexContent, 'utf-8');

  // Generate ImageAnimation.tsx component
  const componentContent = generateImageAnimationComponent(imageUrl, styleConfig, durationInFrames);
  await writeFile(join(projectDir, 'SvgAnimation.tsx'), componentContent, 'utf-8');

  // Update workspace Root.tsx to include this composition
  const workspacePath = getWorkspacePath();
  await updateRootTsx(workspacePath, compositionId, workspaceCompositionId, durationInFrames, fps, width, height);

  logger.info({ projectDir, animationStyle, imageUrl }, 'Generated image animation composition files');
}

/**
 * Generate index.tsx for image-based animation
 */
function generateImageIndexTsx(
  compositionId: string,
  imageUrl: string,
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
          animationType: 'motion',
          springConfig: {
            damping: ${styleConfig.springDamping},
            mass: ${styleConfig.springMass},
            stiffness: ${styleConfig.springStiffness},
          },
          imageUrl: '${imageUrl}',
        }}
      />
    </>
  );
};

export default ${compositionId.replace(/-/g, '_')};
`;
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
 * Generate image animation component - displays the actual image with animation
 * (not converted to SVG)
 */
function generateImageAnimationComponent(
  imageUrl: string,
  styleConfig: any,
  durationInFrames: number
): string {
  return `import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate, Img, staticFile } from 'remotion';

interface Props {
  animationType: string;
  springConfig: {
    damping: number;
    mass: number;
    stiffness: number;
  };
  imageUrl?: string;
}

export const SvgAnimation: React.FC<Props> = ({ springConfig, imageUrl }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Scale animation with spring
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

  // Subtle rotation for entrance
  const rotation = interpolate(
    frame,
    [0, Math.floor(durationInFrames * 0.3)],
    [-3, 0],
    { extrapolateRight: 'clamp' }
  );

  // Translate Y for entrance effect
  const translateY = interpolate(
    frame,
    [0, Math.floor(durationInFrames * 0.4)],
    [30, 0],
    { extrapolateRight: 'clamp' }
  );

  const imgSrc = imageUrl || '${imageUrl}';

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
          maxWidth: '80%',
          maxHeight: '80%',
        }}
      >
        <Img
          src={imgSrc}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
          }}
        />
      </div>
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
    startMs: defaultStartMs,
    width,
    height,
    description,
    sceneId,
    useOriginalImage,
  } = job.data;

  const fps = 30;
  const durationMs = durationSeconds * 1000;
  const compositionId = `svg-anim-${jobId.slice(0, 8)}`;
  const workspaceCompositionId = compositionId.replace(/-/g, '_');

  // Determine actual startMs based on description, sceneId, or default
  let startMs = defaultStartMs;
  let placementSource = 'default';

  // First priority: search transcript based on description (e.g., "when I say front matter")
  if (description) {
    const searchKeywords = extractSearchKeywords(description);
    if (searchKeywords) {
      const transcriptStartMs = await findTimestampInTranscript(projectId, searchKeywords);
      if (transcriptStartMs !== null) {
        startMs = transcriptStartMs;
        placementSource = 'transcript';
        logger.info({ projectId, description, searchKeywords, startMs }, 'Found timestamp from transcript');
      }
    }
  }

  // Second priority: if no transcript match and sceneId provided, use scene's startMs
  if (placementSource === 'default' && sceneId) {
    try {
      const projectVisual = await db.query.visuals.findFirst({
        where: eq(visuals.projectId, projectId),
      });

      if (projectVisual?.timestamps && Array.isArray(projectVisual.timestamps)) {
        const scene = (projectVisual.timestamps as any[]).find((t: any) => t.id === sceneId);
        if (scene?.startMs !== undefined) {
          startMs = scene.startMs;
          placementSource = 'scene';
          logger.info({ projectId, sceneId, startMs }, 'Using scene startMs for animation placement');
        }
      }
    } catch (err) {
      logger.warn({ projectId, sceneId, err }, 'Failed to find scene for placement');
    }
  }

  logger.info({ projectId, jobId, description, sceneId, startMs, placementSource }, 'Processing SVG animation with placement context');

  try {
    // Update job status
    await db.update(jobs)
      .set({ status: 'processing', progress: 0 })
      .where(eq(jobs.id, jobId));

    await publishJobProgress(jobId, 5, 'Downloading image...');

    // Download image from S3
    const imageExt = imageKey.split('.').pop() || 'png';
    const imagePath = join(tmpdir(), `svg-anim-${jobId}-image.${imageExt}`);
    await downloadFile('uploads', imageKey, imagePath);

    logger.info({ projectId, jobId, imagePath, useOriginalImage }, 'Image downloaded');

    // Create project directory in workspace
    const workspacePath = getWorkspacePath();
    const projectDir = createProjectDir(workspaceCompositionId);

    let svg: string;
    let imagePublicUrl: string | undefined;

    if (useOriginalImage) {
      // Use original image - copy to outputs and create image-based animation
      await publishJobProgress(jobId, 15, 'Preparing image...');

      // Copy image to outputs bucket for public access
      const outputImageKey = `images/${compositionId}/image.${imageExt}`;
      await uploadFile('outputs', outputImageKey, imagePath);
      imagePublicUrl = `/api/media/outputs/${outputImageKey}`;

      logger.info({ projectId, jobId, imagePublicUrl }, 'Image uploaded for animation');

      await publishJobProgress(jobId, 40, 'Generating animated composition...');

      // Generate image-based animation (not SVG)
      await generateImageAnimatedComposition(projectDir, imagePublicUrl, {
        compositionId,
        workspaceCompositionId,
        animationStyle,
        durationSeconds,
        width,
        height,
        fps,
      });
    } else {
      // Convert image to SVG using OpenAI Vision
      await publishJobProgress(jobId, 15, 'Converting image to SVG...');

      svg = await convertImageToSvg(imagePath, width, height, animationType);

      logger.info({ projectId, jobId, svgLength: svg.length }, 'SVG generated from image');

      await publishJobProgress(jobId, 40, 'Generating animated composition...');

      // Generate SVG-based Remotion composition
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
    }

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
      // Look for an existing visual track first
      const existingTracks = await db.select().from(tracks).where(eq(tracks.projectId, projectId));
      const existingVisualTrack = existingTracks.find(t => t.type === 'visual');

      if (existingVisualTrack) {
        targetTrackId = existingVisualTrack.id;
        logger.info({ projectId, trackId: targetTrackId }, 'Using existing visual track');
      } else {
        // Create a new "Animations" track
        const [newTrack] = await db.insert(tracks).values({
          projectId,
          type: 'visual',
          name: 'Animations',
          position: existingTracks.length,
        }).returning();
        targetTrackId = newTrack.id;
        logger.info({ projectId, trackId: targetTrackId }, 'Created new visual track');
      }
    }

    // Create visual record - include user description if provided
    const animationDescription = description || `SVG ${animationType} animation`;
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
        description: animationDescription,
        sceneId: sceneId || undefined,
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
        description: animationDescription,
        width,
        height,
        fps,
        sceneId: sceneId || undefined,
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
