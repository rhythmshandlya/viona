import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { TransformWrapper } from './composition/TransformWrapper';
import { FullComposition } from './composition/FullComposition';
import { VideoItem, AudioItem, TextItem, ImageItem, SceneItem as SceneItemComponent, ShapeItem, CaptionItem } from './items';
import type { LayoutSegment, SceneItem, DisplayMode, SplitSettings } from './composition/types';
import { sceneRegistry } from './scene-registry';

interface ManifestItem {
  id: string;
  type: string;
  trackId: string;
  startMs: number;
  endMs: number;
  data: any;
  transform?: any;
  keyframes?: any[];
  filters?: any;
}

interface ManifestTrack {
  id: string;
  type: string;
  name: string;
  position: number;
}

interface Manifest {
  version: number;
  fps: number;
  durationMs: number;
  canvas: { width: number; height: number };
  tracks: ManifestTrack[];
  items: ManifestItem[];
  assets: Record<string, string>;
  captionStyle?: any;
}

interface PlayerCompositionProps {
  manifest: Manifest;
}

/**
 * Map manifest displayMode values to FullComposition DisplayMode.
 * Manifest uses "stacked" / "default" for the split layout.
 */
function toDisplayMode(mode?: string): DisplayMode {
  if (mode === 'fullscreen') return 'fullscreen';
  if (mode === 'overlay') return 'overlay';
  return 'default'; // "stacked", "default", or unset → default (speaker visible)
}

/**
 * Build FullComposition props from manifest items.
 * Returns null if there are no scene items (fall back to simple rendering).
 */
function buildLayoutProps(items: ManifestItem[], fps: number, durationMs: number) {
  const sceneItems = items.filter(i => i.type === 'scene');
  if (sceneItems.length === 0) return null;

  // Build layout segments from scene items — each scene defines its display mode
  // for the frame range it occupies. Gaps between scenes default to 'default'.
  const totalFrames = Math.ceil((durationMs / 1000) * fps);
  const segments: LayoutSegment[] = [];
  let lastEndFrame = 0;

  const sorted = [...sceneItems].sort((a, b) => a.startMs - b.startMs);

  for (const item of sorted) {
    const startFrame = Math.round((item.startMs / 1000) * fps);
    const endFrame = Math.round((item.endMs / 1000) * fps);
    const mode = toDisplayMode(item.data?.displayMode);

    // Fill gap before this scene with default mode
    if (startFrame > lastEndFrame) {
      segments.push({ startFrame: lastEndFrame, endFrame: startFrame, displayMode: 'default' });
    }

    segments.push({ startFrame, endFrame, displayMode: mode });
    lastEndFrame = endFrame;
  }

  // Fill trailing gap
  if (lastEndFrame < totalFrames) {
    segments.push({ startFrame: lastEndFrame, endFrame: totalFrames, displayMode: 'default' });
  }

  // Build SceneItem[] for FullComposition's SceneTransitionLayer
  const compositionSceneItems: SceneItem[] = sorted.map(item => {
    const startFrame = Math.round((item.startMs / 1000) * fps);
    const endFrame = Math.round((item.endMs / 1000) * fps);
    return {
      id: item.id,
      startFrame,
      endFrame,
      sceneFile: item.data?.sceneFile || '',
      displayMode: toDisplayMode(item.data?.displayMode),
    };
  });

  return { segments, compositionSceneItems };
}

export const PlayerComposition: React.FC<PlayerCompositionProps> = ({ manifest }) => {
  const { fps, canvas, tracks, items, assets, captionStyle, durationMs } = manifest;
  const sortedTracks = [...tracks].sort((a, b) => a.position - b.position);

  // Find the source video item (first video type item)
  const videoItem = items.find(i => i.type === 'video');
  const sourceVideoFile = videoItem?.data?.src;

  // Find audio items
  const audioItem = items.find(i => i.type === 'audio');
  const audioFile = audioItem?.data?.src;

  // Try to build layout props from scene items
  const layoutProps = buildLayoutProps(items, fps, durationMs);

  // If we have scene items, use FullComposition with proper display mode layout
  if (layoutProps && sourceVideoFile) {
    const splitSettings: SplitSettings = {
      position: 'video-first', // speaker on bottom, visuals on top
      ratio: 55,               // 55% visuals, 45% speaker
      gap: 0,
    };

    // Non-scene items (text, image, shape, caption) rendered as overlay children
    const overlayItems = items.filter(i =>
      i.type !== 'video' && i.type !== 'audio' && i.type !== 'scene'
    );

    return (
      <FullComposition
        layoutMode="stacked"
        splitSettings={splitSettings}
        layoutSegments={layoutProps.segments}
        videoCropSettings={{ sourceWidth: canvas.width, sourceHeight: canvas.height, cropX: 0, cropY: 0, scale: 1 }}
        sourceVideoFile={sourceVideoFile}
        audioFile={audioFile}
        backgroundColor="#000"
        sceneItems={layoutProps.compositionSceneItems}
        renderScene={(sceneFile, _frameOffset) => {
          const SceneComponent = sceneRegistry[sceneFile]
            || sceneRegistry[`${sceneFile}.tsx`]
            || sceneRegistry[`${sceneFile}.ts`];

          if (!SceneComponent) {
            return (
              <div style={{
                width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: '#1a1a2e', color: '#e74c3c',
                fontFamily: 'monospace', fontSize: 18,
              }}>
                Scene not found: {sceneFile}
              </div>
            );
          }

          return (
            <SceneComponent
              width={canvas.width}
              height={canvas.height}
              durationInFrames={Math.ceil((durationMs / 1000) * fps)}
              fps={fps}
            />
          );
        }}
      >
        {/* Overlay items (text, image, shape, caption) rendered on top */}
        {overlayItems.length > 0 && (
          <AbsoluteFill>
            {overlayItems.map(item => {
              const startFrame = Math.round((item.startMs / 1000) * fps);
              const durationInFrames = Math.max(1, Math.round(((item.endMs - item.startMs) / 1000) * fps));
              return (
                <Sequence key={item.id} from={startFrame} durationInFrames={durationInFrames} layout="none">
                  {item.transform ? (
                    <TransformWrapper transform={item.transform} keyframes={item.keyframes} filters={item.filters} fps={fps}>
                      <ItemRenderer item={item} assets={assets} fps={fps} durationInFrames={durationInFrames} canvas={canvas} captionStyle={captionStyle} />
                    </TransformWrapper>
                  ) : (
                    <ItemRenderer item={item} assets={assets} fps={fps} durationInFrames={durationInFrames} canvas={canvas} captionStyle={captionStyle} />
                  )}
                </Sequence>
              );
            })}
          </AbsoluteFill>
        )}
      </FullComposition>
    );
  }

  // Fallback: no scene items — render all items as flat layers (original behavior)
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {sortedTracks.map(track => {
        const trackItems = items.filter(item => item.trackId === track.id);
        if (trackItems.length === 0) return null;

        return (
          <AbsoluteFill key={track.id}>
            {trackItems.map(item => {
              const startFrame = Math.round((item.startMs / 1000) * fps);
              const durationInFrames = Math.max(1, Math.round(((item.endMs - item.startMs) / 1000) * fps));

              return (
                <Sequence key={item.id} from={startFrame} durationInFrames={durationInFrames} layout="none">
                  {item.transform ? (
                    <TransformWrapper transform={item.transform} keyframes={item.keyframes} filters={item.filters} fps={fps}>
                      <ItemRenderer item={item} assets={assets} fps={fps} durationInFrames={durationInFrames} canvas={canvas} captionStyle={captionStyle} />
                    </TransformWrapper>
                  ) : (
                    <ItemRenderer item={item} assets={assets} fps={fps} durationInFrames={durationInFrames} canvas={canvas} captionStyle={captionStyle} />
                  )}
                </Sequence>
              );
            })}
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};

interface ItemRendererProps {
  item: ManifestItem;
  assets: Record<string, string>;
  fps: number;
  durationInFrames: number;
  canvas: { width: number; height: number };
  captionStyle?: any;
}

const ItemRenderer: React.FC<ItemRendererProps> = ({
  item,
  assets,
  fps,
  durationInFrames,
  canvas,
  captionStyle,
}) => {
  switch (item.type) {
    case 'video':
      return <VideoItem data={item.data} assets={assets} fps={fps} durationInFrames={durationInFrames} />;
    case 'audio':
      return <AudioItem data={item.data} assets={assets} fps={fps} />;
    case 'text':
      return <TextItem data={item.data} />;
    case 'image':
      return <ImageItem data={item.data} assets={assets} />;
    case 'scene':
      return (
        <SceneItemComponent
          data={item.data}
          width={canvas.width}
          height={canvas.height}
          durationInFrames={durationInFrames}
          fps={fps}
          sceneRegistry={sceneRegistry}
        />
      );
    case 'shape':
      return <ShapeItem data={item.data} />;
    case 'caption':
      return <CaptionItem data={item.data} captionStyle={captionStyle || {}} fps={fps} itemStartMs={item.startMs} />;
    default:
      return null;
  }
};
