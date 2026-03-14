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
 * Generate PlayerComposition.tsx for the workspace.
 *
 * If an AI-generated Composition.tsx exists, wraps it with an error boundary.
 * Otherwise, uses FullComposition with scene discovery and manifest conversion.
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

  // Collect fonts from text overlay items as well
  let textFontFamilies: string[] = [];
  try {
    const manifestJson2 = await readFile(manifestPath, 'utf-8');
    const manifest2 = JSON.parse(manifestJson2);
    textFontFamilies = (manifest2.items || [])
      .filter((i: any) => i.type === 'text' && i.data?.fontFamily)
      .map((i: any) => i.data.fontFamily as string);
  } catch {
    // ignore
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
import { useVideoConfig, AbsoluteFill, Sequence, Audio, staticFile } from 'remotion';
import { FullComposition } from './composition/index';
import { OverlayLayer } from './composition/OverlayLayer';
import type { SceneItem, SubtitleItemData, SubtitleWordData, SubtitleStyle, LayoutSegment } from './composition/types';
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

// ---- Subtitle builder (shared by both paths) ----

function buildSubtitles(items: any[]): SubtitleItemData[] {
  return items
    .filter((it: any) => it.type === 'caption')
    .map((it: any) => ({
      startMs: it.startMs,
      endMs: it.endMs,
      words: (it.data?.words || []).map((w: any) => ({
        text: w.text,
        // Word timings in the manifest are absolute ms (from DB via dbToManifest)
        startMs: w.startMs,
        endMs: w.endMs,
        styleOverrides: w.styleOverrides,
      })),
    }));
}

// ---- Layout / scene helpers for FullComposition ----

function buildLayoutSegments(
  items: any[],
  fps: number,
  totalDurationMs: number,
): LayoutSegment[] {
  const visualItems = items
    .filter((it: any) => it.type === 'visual' || it.type === 'scene')
    .sort((a: any, b: any) => a.startMs - b.startMs);

  if (visualItems.length === 0) {
    const totalFrames = Math.ceil((totalDurationMs / 1000) * fps);
    return [{ startFrame: 0, endFrame: totalFrames, displayMode: 'overlay' }];
  }

  const segments: LayoutSegment[] = [];
  let lastEndFrame = 0;

  for (const item of visualItems) {
    const startFrame = Math.round((item.startMs / 1000) * fps);
    const endFrame = Math.round((item.endMs / 1000) * fps);
    let displayMode: string = item.data?.displayMode || 'default';
    if (displayMode === 'pip') displayMode = 'default';

    if (startFrame > lastEndFrame) {
      segments.push({ startFrame: lastEndFrame, endFrame: startFrame, displayMode: 'overlay' });
    }

    segments.push({ startFrame, endFrame, displayMode });
    lastEndFrame = Math.max(lastEndFrame, endFrame);
  }

  const totalFrames = Math.ceil((totalDurationMs / 1000) * fps);
  if (lastEndFrame < totalFrames) {
    segments.push({ startFrame: lastEndFrame, endFrame: totalFrames, displayMode: 'overlay' });
  }

  return segments;
}

function buildSceneItems(items: any[], fps: number): SceneItem[] {
  return items
    .filter((it: any) => it.type === 'visual' || it.type === 'scene')
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

  const subtitles = buildSubtitles(manifest.items);
  const captionStyle: SubtitleStyle | undefined = manifest.captionStyle;

  const overlayTypes = new Set(['text', 'image', 'video', 'shape']);
  const overlayItems = (manifest.items || []).filter((i: any) => overlayTypes.has(i.type));
  const audioOverlayItems = (manifest.items || []).filter((i: any) => i.type === 'audio');

  // AI-generated composition: render it with an error boundary that falls back to FullComposition
  ${hasCompositionTsx ? `if (HAS_AI_COMPOSITION) {
    const fullCompositionFallback = renderFullComposition(manifest, videoUrl, audioUrl, fps, subtitles, captionStyle, overlayItems, audioOverlayItems);
    return (
      <CompositionErrorBoundary fallback={fullCompositionFallback}>
        <ProjectComposition
          videoUrl={videoUrl || ''}
          subtitles={subtitles}
          captionStyle={captionStyle}
        />
      </CompositionErrorBoundary>
    );
  }` : ''}

  return renderFullComposition(manifest, videoUrl, audioUrl, fps, subtitles, captionStyle, overlayItems, audioOverlayItems);
};

function renderFullComposition(
  manifest: any,
  videoUrl: string | undefined,
  audioUrl: string | undefined,
  fps: number,
  subtitles: SubtitleItemData[],
  captionStyle: SubtitleStyle | undefined,
  overlayItems: any[],
  audioOverlayItems: any[],
) {
  const layoutSegments = buildLayoutSegments(manifest.items, fps, manifest.durationMs);
  const sceneItems = buildSceneItems(manifest.items, fps);
  const layout = manifest.layout || {};
  const videoSettings = manifest.videoSettings || {};

  const renderScene = (sceneFile: string, frameOffset: number): React.ReactNode => {
    const SceneComponent = SCENE_MAP[sceneFile];
    if (!SceneComponent) return null;
    return <SceneComponent />;
  };

  return (
    <AbsoluteFill>
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
      {overlayItems.length > 0 && <OverlayLayer items={overlayItems} fps={fps} />}
      {audioOverlayItems.map((item: any) => {
        const sf = Math.round((item.startMs / 1000) * fps);
        const ef = Math.round((item.endMs / 1000) * fps);
        return (
          <Sequence key={item.id} from={sf} durationInFrames={Math.max(1, ef - sf)}>
            <Audio src={staticFile(item.data?.src || '')} volume={item.data?.volume ?? 1} />
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
