/**
 * Converts a @viona/shared Manifest into FullCompositionProps
 * for the Remotion FullComposition renderer.
 */
import type {
  Manifest,
  ManifestCaptionItemData,
  ManifestVisualItemData,
} from '@viona/shared';
import type {
  LayoutSegment,
  VideoCropSettings,
} from './types.js';

// These types mirror the FullComposition prop interfaces from remotion-template.
// We declare them locally because remotion-template is outside the worker's rootDir
// and cannot be imported via tsc. Keep in sync with remotion-template/src/composition/types.ts.

interface SubtitleWordData {
  text: string;
  startMs: number;
  endMs: number;
  styleOverrides?: Record<string, unknown>;
}

interface SubtitleItemData {
  startMs: number;
  endMs: number;
  words: SubtitleWordData[];
  style?: Record<string, unknown>;
}

type SubtitleStyle = Record<string, unknown>;

interface PiPSettings {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  offsetX: number;
  offsetY: number;
  size: number;
  shape: 'square' | 'circle' | 'rounded';
  borderRadius: number;
  borderWidth: number;
  borderColor: string;
  shadowEnabled: boolean;
  shadowColor: string;
  shadowBlur: number;
  opacity: number;
  rotation: number;
}

interface SceneItem {
  id: string;
  startFrame: number;
  endFrame: number;
  sceneFile: string;
  displayMode: string;
  frameOffset?: number;
  enter?: { type: string; durationMs: number };
  exit?: { type: string; durationMs: number };
}

interface FullCompositionProps {
  layoutMode: 'stacked' | 'pip';
  splitSettings: { position: 'visuals-first' | 'video-first'; ratio: number; gap: number };
  pipSettings?: PiPSettings;
  layoutSegments: LayoutSegment[];
  sceneItems?: SceneItem[];
  videoCropSettings: VideoCropSettings;
  sourceVideoFile?: string;
  audioFile?: string;
  backgroundColor?: string;
  subtitles?: SubtitleItemData[];
  defaultSubtitleStyle?: SubtitleStyle;
}

/** Gaps smaller than this (in ms) are absorbed rather than filled with a default segment. */
const GAP_THRESHOLD_MS = 50;

/**
 * Build frame-based LayoutSegments from manifest visual items.
 * Fills gaps between visual items with 'default' mode segments.
 * Normalises 'pip' displayMode to 'default'.
 */
function buildLayoutSegments(
  visualItems: Array<{ startMs: number; endMs: number; data: ManifestVisualItemData }>,
  fps: number,
  totalDurationMs: number,
): LayoutSegment[] {
  const sorted = [...visualItems].sort((a, b) => a.startMs - b.startMs);
  const segments: LayoutSegment[] = [];
  let lastEndMs = 0;

  for (const item of sorted) {
    // Fill gap before this item if significant
    if (item.startMs > lastEndMs + GAP_THRESHOLD_MS) {
      segments.push({
        startFrame: Math.round((lastEndMs / 1000) * fps),
        endFrame: Math.round((item.startMs / 1000) * fps),
        displayMode: 'default',
      });
    }

    let dm: string = item.data.displayMode || 'default';
    if (dm === 'pip') dm = 'default';

    segments.push({
      startFrame: Math.round((item.startMs / 1000) * fps),
      endFrame: Math.round((item.endMs / 1000) * fps),
      displayMode: dm as 'default' | 'fullscreen' | 'overlay',
    });

    lastEndMs = item.endMs;
  }

  // Fill trailing gap
  if (lastEndMs < totalDurationMs - GAP_THRESHOLD_MS) {
    segments.push({
      startFrame: Math.round((lastEndMs / 1000) * fps),
      endFrame: Math.round((totalDurationMs / 1000) * fps),
      displayMode: 'default',
    });
  }

  return segments;
}

/**
 * Build SubtitleItemData[] from manifest caption items.
 * Caption word timings are relative to the item's startMs — convert to absolute.
 */
function buildSubtitles(
  captionItems: Array<{ startMs: number; endMs: number; data: ManifestCaptionItemData }>,
): SubtitleItemData[] {
  const sorted = [...captionItems].sort((a, b) => a.startMs - b.startMs);

  return sorted.map((item) => {
    const words: SubtitleWordData[] = item.data.words.map((w) => ({
      text: w.text,
      startMs: w.startMs + item.startMs, // relative → absolute
      endMs: w.endMs + item.startMs,
      ...(w.styleOverrides ? { styleOverrides: w.styleOverrides as SubtitleWordData['styleOverrides'] } : {}),
    }));

    return {
      startMs: item.startMs,
      endMs: item.endMs,
      words,
    };
  });
}

/**
 * Build PiPSettings from manifest pip config, omitting the `crop` sub-object
 * which is not part of FullComposition's PiPSettings interface.
 */
function buildPiPSettings(
  pip: Manifest['layout']['pip'],
): PiPSettings {
  const { crop: _crop, ...rest } = pip;
  return rest;
}

/**
 * Build SceneItem[] from manifest visual items.
 * Extracts transition config, sceneFile, frameOffset, and displayMode.
 */
function buildSceneItems(
  visualItems: Array<{ id: string; startMs: number; endMs: number; data: ManifestVisualItemData }>,
  fps: number,
): SceneItem[] {
  const sorted = [...visualItems].sort((a, b) => a.startMs - b.startMs);

  return sorted.map((item) => {
    const data = item.data as Record<string, unknown>;
    const transition = data.transition as {
      enter?: { type: string; durationMs: number };
      exit?: { type: string; durationMs: number };
    } | undefined;

    return {
      id: item.id,
      startFrame: Math.round((item.startMs / 1000) * fps),
      endFrame: Math.round((item.endMs / 1000) * fps),
      sceneFile: (data.sceneFile as string) || '',
      displayMode: (data.displayMode as string) || 'default',
      frameOffset: (data.frameOffset as number) || undefined,
      enter: transition?.enter,
      exit: transition?.exit,
    };
  });
}

/**
 * Convert a Manifest into FullCompositionProps ready for Remotion rendering.
 */
export function manifestToProps(manifest: Manifest): FullCompositionProps {
  // Separate visual and caption items
  const visualItems = manifest.items
    .filter((item): item is typeof item & { type: 'visual'; data: ManifestVisualItemData } =>
      item.type === 'visual',
    );

  const captionItems = manifest.items
    .filter((item): item is typeof item & { type: 'caption'; data: ManifestCaptionItemData } =>
      item.type === 'caption',
    );

  const fps = manifest.fps;
  const totalDurationMs = manifest.durationMs;

  // Layout segments from visual items (or single default segment if none)
  const layoutSegments = buildLayoutSegments(visualItems, fps, totalDurationMs);

  // Scene items with transition config
  const sceneItems = buildSceneItems(visualItems, fps);

  // If no visual items produced no segments at all (durationMs within threshold of 0),
  // ensure at least one default segment spanning the full duration.
  if (layoutSegments.length === 0) {
    layoutSegments.push({
      startFrame: 0,
      endFrame: Math.round((totalDurationMs / 1000) * fps),
      displayMode: 'default',
    });
  }

  // Subtitles
  const subtitles = buildSubtitles(captionItems);

  // Default subtitle style from manifest captionStyle
  const cs = manifest.captionStyle;
  const defaultSubtitleStyle: SubtitleStyle = {
    fontFamily: cs.fontFamily,
    fontSize: cs.fontSize,
    fontWeight: cs.fontWeight,
    color: cs.color,
    activeColor: cs.activeColor,
    backgroundColor: cs.backgroundColor,
    activeBackgroundColor: cs.activeBackgroundColor,
    displayMode: cs.displayMode as SubtitleStyle['displayMode'],
    wordsPerPhrase: cs.wordsPerPhrase,
    position: cs.position,
    animation: cs.animation,
    effects: cs.effects as SubtitleStyle['effects'],
    stroke: cs.stroke,
    presetId: cs.presetId ?? undefined,
    opacity: cs.opacity,
    lineHeight: cs.lineHeight,
    letterSpacing: cs.letterSpacing,
    textTransform: cs.textTransform,
    backgroundPadding: cs.backgroundPadding,
    backgroundRadius: cs.backgroundRadius,
  };

  // Video crop settings
  const vs = manifest.videoSettings;
  const videoCropSettings = {
    sourceWidth: vs.sourceWidth,
    sourceHeight: vs.sourceHeight,
    cropX: vs.cropX,
    cropY: vs.cropY,
    scale: vs.scale,
  };

  // PiP settings (only when mode is pip)
  const pipSettings = manifest.layout.mode === 'pip'
    ? buildPiPSettings(manifest.layout.pip)
    : undefined;

  const props: FullCompositionProps = {
    layoutMode: manifest.layout.mode,
    splitSettings: {
      position: manifest.layout.split.position,
      ratio: manifest.layout.split.ratio,
      gap: manifest.layout.split.gap,
    },
    pipSettings,
    layoutSegments,
    ...(sceneItems.length > 0 ? { sceneItems } : {}),
    videoCropSettings,
    ...(subtitles.length > 0 ? { subtitles } : {}),
    defaultSubtitleStyle,
  };

  return props;
}
