/**
 * Remotion component generation for SVG animations
 */

import { writeFile } from 'fs/promises';
import { join } from 'path';
import { SvgAnimationMetadata } from './types.js';
import { getWorkspacePath } from '../../workspace.js';
import { logger } from '../../logger.js';

/**
 * Generate animated Remotion composition from SVG
 */
export async function generateAnimatedComposition(
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
 * Generate animated Remotion composition that displays the original image
 */
export async function generateImageAnimatedComposition(
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
 * Generate index.tsx file content
 */
export function generateIndexTsx(
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
 * Generate index.tsx for image-based animation
 */
export function generateImageIndexTsx(
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
 * Generate SvgAnimation.tsx component with draw or motion animation
 */
export function generateSvgAnimationComponent(
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
export function generateDrawAnimationComponent(
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
export function generateMotionAnimationComponent(
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
export function generateImageAnimationComponent(
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
 * Update workspace Root.tsx to include the new SVG animation composition
 */
export async function updateRootTsx(
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
