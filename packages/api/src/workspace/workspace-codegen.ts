import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { getWorkspaceSrcPath, getScenesPath, getManifestPath } from './workspace-config.js';

interface SceneEntry {
  /** e.g. "scenes/comp_abc123/index.tsx" — matches remapManifestSceneFiles output */
  sceneFileKey: string;
  /** e.g. "./scenes/comp_abc123/index" — for ES import statement */
  importPath: string;
  /** e.g. "Scene_comp_abc123" — sanitised identifier */
  importName: string;
}

/**
 * Discover scene entry points in the workspace's src/scenes/ directory.
 * Each subdirectory that contains an index.tsx is treated as a scene.
 */
export async function discoverScenes(projectId: string): Promise<SceneEntry[]> {
  const scenesDir = getScenesPath(projectId);
  const entries: SceneEntry[] = [];

  let dirEntries: string[];
  try {
    dirEntries = await readdir(scenesDir);
  } catch {
    // scenes/ directory doesn't exist or is empty — no scenes to discover
    return [];
  }

  for (const name of dirEntries) {
    // Check if this subdirectory has an index.tsx
    try {
      const subEntries = await readdir(join(scenesDir, name));
      if (subEntries.includes('index.tsx')) {
        const sanitised = name.replace(/[^a-zA-Z0-9_]/g, '_');
        entries.push({
          sceneFileKey: `scenes/${name}/index.tsx`,
          importPath: `./scenes/${name}/index`,
          importName: `Scene_${sanitised}`,
        });
      }
    } catch {
      // Not a directory or unreadable — skip
    }
  }

  return entries;
}

/**
 * Generate TransformWrapper.tsx in the workspace's src/ directory.
 *
 * Applies per-item spatial transforms (position, size, rotation, opacity),
 * keyframe interpolation, and CSS filters.
 */
export async function generateTransformWrapper(projectId: string): Promise<void> {
  const srcPath = getWorkspaceSrcPath(projectId);

  const code = `import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';

interface Transform {
  x: number | string;
  y: number | string;
  width: number | string;
  height: number | string;
  rotation: number;
  opacity: number;
}

interface Keyframe {
  timeMs: number;
  props: Partial<Transform>;
  easing: string;
}

interface Filters {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  blur?: number;
  hue?: number;
  grayscale?: number;
  sepia?: number;
}

function getEasingFn(easing: string): ((t: number) => number) {
  switch (easing) {
    case 'ease-in': return Easing.in(Easing.ease);
    case 'ease-out': return Easing.out(Easing.ease);
    case 'ease-in-out': return Easing.inOut(Easing.ease);
    case 'spring': return Easing.out(Easing.bezier(0.25, 1.56, 0.42, 1));
    default: {
      // Handle cubic-bezier(a,b,c,d)
      const match = easing.match(/cubic-bezier\\(([^,]+),([^,]+),([^,]+),([^)]+)\\)/);
      if (match) {
        return Easing.bezier(
          parseFloat(match[1]),
          parseFloat(match[2]),
          parseFloat(match[3]),
          parseFloat(match[4]),
        );
      }
      return (t: number) => t; // linear
    }
  }
}

function toPixels(val: number | string, containerSize: number): number {
  if (typeof val === 'number') return val;
  const s = String(val);
  if (s.endsWith('%')) {
    return (parseFloat(s) / 100) * containerSize;
  }
  return parseFloat(s) || 0;
}

function buildFilterString(filters: Filters): string {
  const parts: string[] = [];
  if (filters.brightness != null && filters.brightness !== 1) parts.push(\`brightness(\${filters.brightness})\`);
  if (filters.contrast != null && filters.contrast !== 1) parts.push(\`contrast(\${filters.contrast})\`);
  if (filters.saturation != null && filters.saturation !== 1) parts.push(\`saturate(\${filters.saturation})\`);
  if (filters.blur != null && filters.blur !== 0) parts.push(\`blur(\${filters.blur}px)\`);
  if (filters.hue != null && filters.hue !== 0) parts.push(\`hue-rotate(\${filters.hue}deg)\`);
  if (filters.grayscale != null && filters.grayscale !== 0) parts.push(\`grayscale(\${filters.grayscale})\`);
  if (filters.sepia != null && filters.sepia !== 0) parts.push(\`sepia(\${filters.sepia})\`);
  return parts.join(' ');
}

export const TransformWrapper: React.FC<{
  transform: Transform;
  keyframes?: Keyframe[];
  filters?: Filters;
  children: React.ReactNode;
}> = ({ transform, keyframes, filters, children }) => {
  const frame = useCurrentFrame();
  const { fps, width: canvasW, height: canvasH } = useVideoConfig();
  const currentTimeMs = (frame / fps) * 1000;

  // Start from base transform values
  let x = toPixels(transform.x, canvasW);
  let y = toPixels(transform.y, canvasH);
  let w = toPixels(transform.width, canvasW);
  let h = toPixels(transform.height, canvasH);
  let rotation = transform.rotation;
  let opacity = transform.opacity;

  // Apply keyframe interpolation
  if (keyframes && keyframes.length > 0) {
    const sortedKfs = [...keyframes].sort((a, b) => a.timeMs - b.timeMs);

    const interpProp = (prop: keyof Transform, baseVal: number): number => {
      // Collect keyframes that affect this property
      const relevant = sortedKfs.filter(kf => kf.props[prop] !== undefined);
      if (relevant.length === 0) return baseVal;

      // Build input/output arrays including the base value at t=0
      const inputRange = [0, ...relevant.map(kf => (kf.timeMs / 1000) * fps)];
      const outputRange = [baseVal, ...relevant.map(kf => toPixels(kf.props[prop]!, prop === 'x' || prop === 'width' ? canvasW : prop === 'y' || prop === 'height' ? canvasH : 1))];

      // Use easing from the next keyframe in sequence
      const easing = relevant.length > 0 ? getEasingFn(relevant[0].easing) : (t: number) => t;

      return interpolate(frame, inputRange, outputRange, {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing,
      });
    };

    x = interpProp('x', x);
    y = interpProp('y', y);
    w = interpProp('width', w);
    h = interpProp('height', h);
    rotation = interpProp('rotation', rotation);
    opacity = interpProp('opacity', opacity);
  }

  const style: React.CSSProperties = {
    position: 'absolute',
    left: x,
    top: y,
    width: w,
    height: h,
    transform: \`rotate(\${rotation}deg)\`,
    opacity,
    overflow: 'hidden',
  };

  if (filters) {
    const filterStr = buildFilterString(filters);
    if (filterStr) {
      style.filter = filterStr;
    }
  }

  return <div style={style}>{children}</div>;
};
`;

  await writeFile(join(srcPath, 'TransformWrapper.tsx'), code, 'utf-8');
}

/**
 * Generate PlayerComposition.tsx for the workspace.
 *
 * Renders items using NLE-style per-item transforms with TransformWrapper.
 * If an AI-generated Composition.tsx exists, wraps it with an error boundary.
 */
export async function generatePlayerComposition(projectId: string): Promise<void> {
  const srcPath = getWorkspaceSrcPath(projectId);
  const compositionId = `proj_${projectId.replace(/-/g, '_')}`;
  const compositionDir = join(srcPath, compositionId);

  // Check if AI-generated Composition.tsx exists
  let hasCompositionTsx = false;
  try {
    await readFile(join(compositionDir, 'Composition.tsx'));
    hasCompositionTsx = true;
  } catch {
    // No Composition.tsx
  }

  const scenes = await discoverScenes(projectId);

  // Read manifest once to discover fonts for static imports
  const manifestPath = getManifestPath(projectId);
  let captionFontFamily = 'Inter';
  let textFontFamilies: string[] = [];
  try {
    const manifestJson = await readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestJson);
    captionFontFamily = manifest.captionStyle?.fontFamily || 'Inter';
    textFontFamilies = (manifest.items || [])
      .filter((i: any) => i.type === 'text' && i.data?.fontFamily)
      .map((i: any) => i.data.fontFamily as string);
  } catch {
    // Manifest may not exist yet during initial codegen — default to Inter
  }
  const allFonts = [...new Set([captionFontFamily, ...textFontFamilies].filter(Boolean))];

  const fontImportLines = allFonts
    .filter(f => f !== 'Inter')
    .map(f => {
      const mod = f.replace(/[^a-zA-Z0-9]/g, '');
      return `import { loadFont as loadFont_${mod} } from '@remotion/google-fonts/${mod}';\nloadFont_${mod}();`;
    })
    .join('\n');
  const fontImport = fontImportLines ? fontImportLines + '\n' : '';

  const sceneImports = scenes
    .map(s => `import { MainComposition as ${s.importName} } from '${s.importPath}';`)
    .join('\n');

  const sceneMapEntries = scenes
    .map(s => `  '${s.sceneFileKey}': ${s.importName},`)
    .join('\n');

  // AI Composition import (when available)
  const aiCompositionImport = hasCompositionTsx
    ? `import { ProjectComposition } from './${compositionId}/Composition';`
    : '';

  const code = `import React from 'react';
import { useCurrentFrame, useVideoConfig, AbsoluteFill, Sequence, Audio, Video, Img, staticFile } from 'remotion';
import { TransformWrapper } from './TransformWrapper';
${sceneImports}
${aiCompositionImport}
${fontImport}
// Scene registry — maps sceneFile paths to React components
const SCENE_MAP: Record<string, React.FC<any>> = {
${sceneMapEntries}
};

const HAS_AI_COMPOSITION = ${hasCompositionTsx};

// ---- Error boundary for AI compositions ----

class CompositionErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  state = { hasError: false, error: undefined as Error | undefined };
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// ---- Caption renderer (separate component to satisfy React hooks rules) ----

const CaptionRenderer: React.FC<{ item: any }> = ({ item }) => {
  const d = item.data || {};
  const words: Array<{ text: string; startMs: number; endMs: number }> = d.words || [];

  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentMs = (frame / fps) * 1000;

  if (words.length === 0) return null;

  const activeWords = words.filter(w => currentMs >= w.startMs && currentMs < w.endMs);
  if (activeWords.length === 0) return null;

  const cs = (item as any).__captionStyle || {};
  const fontSize = cs.fontSize || 56;
  const fontFamily = cs.fontFamily || 'Inter, system-ui, sans-serif';
  const fontWeight = cs.fontWeight || 800;
  const color = cs.color || '#FFFFFF';
  const activeColor = cs.activeColor || color;
  const bgColor = cs.backgroundColor || 'transparent';
  const textAlign = cs.position?.textAlign || 'center';

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      padding: '0 40px 120px',
    }}>
      <div style={{
        fontFamily,
        fontSize,
        fontWeight,
        color,
        textAlign,
        lineHeight: 1.2,
        textShadow: '0 2px 8px rgba(0,0,0,0.8)',
        backgroundColor: bgColor !== 'transparent' ? bgColor : undefined,
        borderRadius: bgColor !== 'transparent' ? 8 : undefined,
        padding: bgColor !== 'transparent' ? '8px 16px' : undefined,
      }}>
        {activeWords.map((w, i) => (
          <span key={i} style={{ color: activeColor }}>{w.text} </span>
        ))}
      </div>
    </div>
  );
};

// ---- Item renderer ----

const ItemRenderer: React.FC<{ item: any }> = ({ item }) => {
  const d = item.data || {};

  switch (item.type) {
    case 'video':
      return (
        <Video
          src={staticFile(d.src || '')}
          volume={d.volume ?? 1}
          startFrom={d.startFrom ?? 0}
          playbackRate={d.playbackRate ?? 1}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      );

    case 'audio':
      return <Audio src={staticFile(d.src || '')} volume={d.volume ?? 1} />;

    case 'scene': {
      const SceneComponent = SCENE_MAP[d.sceneFile || ''];
      if (!SceneComponent) return null;
      return <SceneComponent />;
    }

    case 'text':
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: d.fontFamily || 'Inter, system-ui, sans-serif',
            fontSize: d.fontSize || 48,
            fontWeight: d.fontWeight || 600,
            color: d.color || '#FFFFFF',
            backgroundColor: d.backgroundColor || 'transparent',
            textAlign: (d.textAlign as React.CSSProperties['textAlign']) || 'center',
          }}
        >
          {d.text || ''}
        </div>
      );

    case 'image':
      return (
        <Img
          src={staticFile(d.src || '')}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      );

    case 'caption':
      return <CaptionRenderer item={item} />;

    case 'shape': {
      const shapeType = d.shape || 'rectangle';
      const baseStyle: React.CSSProperties = {
        width: '100%',
        height: '100%',
        backgroundColor: d.fill || 'transparent',
        border: d.strokeWidth ? \`\${d.strokeWidth}px solid \${d.stroke || '#FFFFFF'}\` : 'none',
      };

      if (shapeType === 'circle') {
        return <div style={{ ...baseStyle, borderRadius: '50%' }} />;
      }
      if (shapeType === 'line') {
        return (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
            <div style={{ width: '100%', height: d.strokeWidth || 2, backgroundColor: d.stroke || d.fill || '#FFFFFF' }} />
          </div>
        );
      }
      // rectangle
      return <div style={{ ...baseStyle, borderRadius: d.borderRadius || 0 }} />;
    }

    default:
      return null;
  }
};

// ---- Main component ----

export const PlayerComposition: React.FC<{
  manifest: any;
  videoUrl?: string;
  audioUrl?: string;
}> = ({ manifest, videoUrl, audioUrl }) => {
  const { fps } = useVideoConfig();

  if (!manifest || !manifest.items) {
    return null;
  }

  const tracks = (manifest.tracks || []).slice().sort((a: any, b: any) => a.position - b.position);
  const trackOrder = new Map<string, number>();
  tracks.forEach((t: any, i: number) => { trackOrder.set(t.id, i); });

  const items = (manifest.items || [])
    .slice()
    .sort((a: any, b: any) => {
      const trackDiff = (trackOrder.get(a.trackId) ?? 0) - (trackOrder.get(b.trackId) ?? 0);
      if (trackDiff !== 0) return trackDiff;
      return a.startMs - b.startMs;
    });

  ${hasCompositionTsx ? `// AI-generated composition: render with error boundary fallback
  if (HAS_AI_COMPOSITION) {
    const fallback = renderNLEComposition(items, fps, manifest?.captionStyle || {});
    return (
      <CompositionErrorBoundary fallback={fallback}>
        <ProjectComposition
          videoUrl={videoUrl || ''}
          subtitles={[]}
          captionStyle={undefined}
        />
      </CompositionErrorBoundary>
    );
  }` : ''}

  return renderNLEComposition(items, fps, manifest?.captionStyle || {});
};

function renderNLEComposition(items: any[], fps: number, captionStyle?: any) {
  return (
    <AbsoluteFill style={{ backgroundColor: '#000000' }}>
      {items.map((item: any) => {
        const itemWithMeta = item.type === 'caption' ? { ...item, data: { ...item.data }, __captionStyle: captionStyle } : item;

        const startFrame = Math.round((item.startMs / 1000) * fps);
        const endFrame = Math.round((item.endMs / 1000) * fps);
        const durationInFrames = Math.max(1, endFrame - startFrame);

        // Audio items: no transform wrapper
        if (item.type === 'audio') {
          return (
            <Sequence key={item.id} from={startFrame} durationInFrames={durationInFrames} layout="none">
              <ItemRenderer item={itemWithMeta} />
            </Sequence>
          );
        }

        // Default transform: full canvas
        const transform = item.transform || {
          x: 0, y: 0, width: '100%', height: '100%', rotation: 0, opacity: 1,
        };

        return (
          <Sequence key={item.id} from={startFrame} durationInFrames={durationInFrames} layout="none">
            <TransformWrapper
              transform={transform}
              keyframes={item.keyframes}
              filters={item.filters}
            >
              <ItemRenderer item={itemWithMeta} />
            </TransformWrapper>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
`;

  await writeFile(join(srcPath, 'PlayerComposition.tsx'), code, 'utf-8');
}

/**
 * Generate Root.tsx in the workspace's src/ directory.
 * This is the Remotion entry point that registers the Preview composition.
 */
export async function updateRootWithPlayerComposition(
  projectId: string,
  durationMs: number,
  fps: number,
  canvasWidth: number,
  canvasHeight: number,
): Promise<void> {
  const srcPath = getWorkspaceSrcPath(projectId);
  const durationInFrames = Math.ceil((durationMs / 1000) * fps);

  const code = `import React from "react";
import { Composition } from "remotion";
import { PlayerComposition } from "./PlayerComposition";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Preview"
        component={PlayerComposition}
        durationInFrames={${durationInFrames}}
        fps={${fps}}
        width={${canvasWidth}}
        height={${canvasHeight}}
        defaultProps={{
          manifest: {},
          videoUrl: undefined,
          audioUrl: undefined,
        }}
      />
    </>
  );
};
`;

  await writeFile(join(srcPath, 'Root.tsx'), code, 'utf-8');

  // Generate the Remotion entry point (index.ts) that registers the root component
  const entryCode = `import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
`;
  await writeFile(join(srcPath, 'index.ts'), entryCode, 'utf-8');
}
