import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { TransformWrapper } from './composition/TransformWrapper';
import { VideoItem, AudioItem, TextItem, ImageItem, SceneItem as SceneItemComponent, ShapeItem, CaptionItem } from './items';
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
  style?: React.CSSProperties;
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

const FULL_CANVAS_TRANSFORM = {
  x: 0, y: 0, width: '100%', height: '100%', rotation: 0, opacity: 1,
};

export const PlayerComposition: React.FC<PlayerCompositionProps> = ({ manifest }) => {
  const { fps, canvas, items, assets, captionStyle } = manifest;
  const sortedTracks = [...manifest.tracks].sort((a, b) => a.position - b.position);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {sortedTracks.map(track => {
        const trackItems = items
          .filter(item => item.trackId === track.id)
          .sort((a, b) => a.startMs - b.startMs);
        if (trackItems.length === 0) return null;

        return (
          <AbsoluteFill key={track.id}>
            {trackItems.map(item => {
              const startFrame = Math.round((item.startMs / 1000) * fps);
              const durationInFrames = Math.max(1, Math.round(((item.endMs - item.startMs) / 1000) * fps));

              // Audio items: layout="none" (no visual container needed), no premount
              if (item.type === 'audio') {
                return (
                  <Sequence key={item.id} from={startFrame} durationInFrames={durationInFrames} layout="none">
                    <ItemRenderer item={item} assets={assets} fps={fps} durationInFrames={durationInFrames} canvas={canvas} captionStyle={captionStyle} />
                  </Sequence>
                );
              }

              // Visual items: premount video/image sequences so media elements
              // load before becoming visible (avoids flash at cut boundaries).
              // premountFor requires a container (no layout="none").
              const needsPremount = item.type === 'video' || item.type === 'image';
              const premountFrames = needsPremount ? fps * 2 : 0; // 2s buffer for video seek

              const transform = item.transform ?? FULL_CANVAS_TRANSFORM;
              return (
                <Sequence key={item.id} from={startFrame} durationInFrames={durationInFrames} premountFor={premountFrames}>
                  <TransformWrapper transform={transform} keyframes={item.keyframes} filters={item.filters} fps={fps} style={item.style}>
                    <ItemRenderer item={item} assets={assets} fps={fps} durationInFrames={durationInFrames} canvas={canvas} captionStyle={captionStyle} />
                  </TransformWrapper>
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

const ItemRenderer: React.FC<ItemRendererProps> = ({ item, assets, fps, durationInFrames, canvas, captionStyle }) => {
  switch (item.type) {
    case 'video':
      return <VideoItem data={item.data} assets={assets} fps={fps} durationInFrames={durationInFrames} />;
    case 'audio':
      return <AudioItem data={item.data} assets={assets} fps={fps} />;
    case 'text':
      return <TextItem data={item.data} />;
    case 'image':
      return <ImageItem data={item.data} assets={assets} />;
    case 'scene': {
      const sceneWidth = item.transform?.width != null
        ? (typeof item.transform.width === 'string' && item.transform.width.endsWith('%')
          ? (parseFloat(item.transform.width) / 100) * canvas.width
          : Number(item.transform.width))
        : canvas.width;
      const sceneHeight = item.transform?.height != null
        ? (typeof item.transform.height === 'string' && item.transform.height.endsWith('%')
          ? (parseFloat(item.transform.height) / 100) * canvas.height
          : Number(item.transform.height))
        : canvas.height;
      return (
        <SceneItemComponent
          data={item.data}
          width={sceneWidth}
          height={sceneHeight}
          durationInFrames={durationInFrames}
          fps={fps}
          sceneRegistry={sceneRegistry}
        />
      );
    }
    case 'shape':
      return <ShapeItem data={item.data} />;
    case 'caption':
      return <CaptionItem data={item.data} captionStyle={captionStyle || {}} fps={fps} itemStartMs={item.startMs} />;
    default:
      return null;
  }
};
