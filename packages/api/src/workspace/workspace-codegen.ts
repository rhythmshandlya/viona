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
 * Generate PlayerComposition.tsx — detects v2 (AI-generated Composition.tsx) vs v1 (legacy codegen).
 */
export async function generatePlayerComposition(projectId: string): Promise<void> {
  const srcPath = getWorkspaceSrcPath(projectId);
  const compositionId = `proj_${projectId.replace(/-/g, '_')}`;
  const compositionDir = join(srcPath, compositionId);

  // Check if AI-generated Composition.tsx exists (v2)
  let hasCompositionTsx = false;
  try {
    await readFile(join(compositionDir, 'Composition.tsx'));
    hasCompositionTsx = true;
  } catch {
    // No Composition.tsx — fall back to legacy v1 codegen
  }

  if (hasCompositionTsx) {
    await generateV2PlayerComposition(projectId, srcPath, compositionId);
  } else {
    await generateV1PlayerComposition(projectId, srcPath);
  }
}

/**
 * v2 codegen — thin wrapper around AI-generated Composition.tsx with error boundary.
 */
async function generateV2PlayerComposition(
  projectId: string,
  srcPath: string,
  compositionId: string,
): Promise<void> {
  const code = `import React from 'react';
import { Composition } from './${compositionId}/Composition';

class CompositionErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  state = { hasError: false, error: undefined as Error | undefined };
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ width: '100%', height: '100%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: '#f44', fontFamily: 'monospace', fontSize: 14, padding: 20, textAlign: 'center' }}>
            Composition error: {this.state.error?.message || 'Unknown error'}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

export const PlayerComposition: React.FC<{
  manifest: any;
  videoUrl?: string;
  audioUrl?: string;
}> = ({ manifest, videoUrl, audioUrl }) => {
  const subtitles = (manifest?.items || [])
    .filter((it: any) => it.type === 'caption')
    .map((it: any) => ({
      startMs: it.startMs,
      endMs: it.endMs,
      words: (it.data?.words || []).map((w: any) => ({
        text: w.text,
        startMs: w.startMs + it.startMs,
        endMs: w.endMs + it.startMs,
      })),
    }));

  return (
    <CompositionErrorBoundary>
      <Composition
        videoUrl={videoUrl || ''}
        subtitles={subtitles}
        captionStyle={manifest?.captionStyle}
      />
    </CompositionErrorBoundary>
  );
};
`;

  await writeFile(join(srcPath, 'PlayerComposition.tsx'), code, 'utf-8');
}

/**
 * v1 codegen (legacy) — generates PlayerComposition.tsx with inline layout conversion logic.
 *
 * This file:
 * - Imports FullComposition from the local composition/ directory
 * - Imports all discovered scene entry points
 * - Converts manifest JSON props → FullCompositionProps inline
 * - Renders FullComposition with the converted props
 */
async function generateV1PlayerComposition(projectId: string, srcPath: string): Promise<void> {
  const scenes = await discoverScenes(projectId);

  // Read manifest to determine caption font family for static import
  const manifestPath = getManifestPath(projectId);
  let captionFontFamily = 'Inter';
  try {
    const manifestJson = await readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestJson);
    captionFontFamily = manifest.captionStyle?.fontFamily || 'Inter';
  } catch {
    // Manifest may not exist yet during initial codegen — default to Inter
  }

  const fontModuleName = captionFontFamily.replace(/[^a-zA-Z0-9]/g, '');
  const fontImport = captionFontFamily !== 'Inter'
    ? `import { loadFont } from '@remotion/google-fonts/${fontModuleName}';\nloadFont();\n`
    : '';

  const sceneImports = scenes
    .map(s => `import { MainComposition as ${s.importName} } from '${s.importPath}';`)
    .join('\n');

  const sceneMapEntries = scenes
    .map(s => `  '${s.sceneFileKey}': ${s.importName},`)
    .join('\n');

  const code = `import React from 'react';
import { useVideoConfig } from 'remotion';
import { FullComposition } from './composition/index';
import type { SceneItem, SubtitleItemData, SubtitleWordData, SubtitleStyle, LayoutSegment } from './composition/types';
${sceneImports}
${fontImport}
// Scene registry — maps sceneFile paths to React components
const SCENE_MAP: Record<string, React.FC<any>> = {
${sceneMapEntries}
};

// ---- Inline conversion helpers (manifest JSON → FullCompositionProps) ----

function buildLayoutSegments(
  items: any[],
  fps: number,
  totalDurationMs: number,
): LayoutSegment[] {
  const visualItems = items
    .filter((it: any) => it.type === 'visual')
    .sort((a: any, b: any) => a.startMs - b.startMs);

  if (visualItems.length === 0) {
    // No visuals — use overlay so video fills the entire canvas
    const totalFrames = Math.ceil((totalDurationMs / 1000) * fps);
    return [{ startFrame: 0, endFrame: totalFrames, displayMode: 'overlay' }];
  }

  const segments: LayoutSegment[] = [];
  let lastEndFrame = 0;

  for (const item of visualItems) {
    const startFrame = Math.round((item.startMs / 1000) * fps);
    const endFrame = Math.round((item.endMs / 1000) * fps);
    let displayMode: string = item.data?.displayMode || 'default';
    if (displayMode === 'pip') displayMode = 'default'; // Normalise pip → default

    // Fill gap before this visual — video fullscreen during gaps
    if (startFrame > lastEndFrame) {
      segments.push({ startFrame: lastEndFrame, endFrame: startFrame, displayMode: 'overlay' });
    }

    segments.push({ startFrame, endFrame, displayMode });
    lastEndFrame = Math.max(lastEndFrame, endFrame);
  }

  // Fill trailing gap — video fullscreen after last visual
  const totalFrames = Math.ceil((totalDurationMs / 1000) * fps);
  if (lastEndFrame < totalFrames) {
    segments.push({ startFrame: lastEndFrame, endFrame: totalFrames, displayMode: 'overlay' });
  }

  return segments;
}

function buildSceneItems(items: any[], fps: number): SceneItem[] {
  return items
    .filter((it: any) => it.type === 'visual')
    .map((it: any) => {
      const startFrame = Math.round((it.startMs / 1000) * fps);
      const endFrame = Math.round((it.endMs / 1000) * fps);
      const data = it.data || {};

      const sceneItem: SceneItem = {
        id: it.id,
        startFrame,
        endFrame,
        sceneFile: data.sceneFile || '',
        displayMode: data.displayMode || 'default',
        frameOffset: data.frameOffset ?? undefined,
      };

      if (data.transition?.enter) {
        sceneItem.enter = {
          type: data.transition.enter.type || 'cut',
          durationMs: data.transition.enter.durationMs || 0,
        };
      }
      if (data.transition?.exit) {
        sceneItem.exit = {
          type: data.transition.exit.type || 'cut',
          durationMs: data.transition.exit.durationMs || 0,
        };
      }

      return sceneItem;
    });
}

function buildSubtitles(items: any[]): SubtitleItemData[] {
  return items
    .filter((it: any) => it.type === 'caption')
    .map((it: any) => {
      const words: SubtitleWordData[] = (it.data?.words || []).map((w: any) => ({
        text: w.text,
        // Word timings are relative to item start — convert to absolute
        startMs: w.startMs + it.startMs,
        endMs: w.endMs + it.startMs,
        styleOverrides: w.styleOverrides,
      }));

      return {
        startMs: it.startMs,
        endMs: it.endMs,
        words,
      } as SubtitleItemData;
    });
}

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

  const layoutSegments = buildLayoutSegments(manifest.items, fps, manifest.durationMs);
  const sceneItems = buildSceneItems(manifest.items, fps);
  const subtitles = buildSubtitles(manifest.items);

  const renderScene = (sceneFile: string, frameOffset: number): React.ReactNode => {
    const SceneComponent = SCENE_MAP[sceneFile];
    if (!SceneComponent) {
      return null;
    }
    return <SceneComponent />;
  };

  const layout = manifest.layout || {};
  const videoSettings = manifest.videoSettings || {};
  const captionStyle: SubtitleStyle | undefined = manifest.captionStyle;

  return (
    <FullComposition
      layoutMode={layout.mode || 'stacked'}
      splitSettings={layout.split || { position: 'visuals-first', ratio: 50, gap: 0 }}
      pipSettings={layout.pip}
      layoutSegments={layoutSegments}
      videoCropSettings={{
        sourceWidth: videoSettings.sourceWidth || 1920,
        sourceHeight: videoSettings.sourceHeight || 1080,
        cropX: videoSettings.cropX ?? 50,
        cropY: videoSettings.cropY ?? 50,
        scale: videoSettings.scale ?? 1,
      }}
      sourceVideoFile={videoUrl}
      audioFile={audioUrl}
      backgroundColor="#000000"
      subtitles={subtitles}
      defaultSubtitleStyle={captionStyle}
      sceneItems={sceneItems}
      renderScene={renderScene}
    />
  );
};
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
