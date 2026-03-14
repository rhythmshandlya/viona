import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { TextOverlay } from './TextOverlay';
import { ImageOverlay } from './ImageOverlay';
import { VideoOverlay } from './VideoOverlay';
import { AudioOverlay } from './AudioOverlay';

interface OverlayItemFilters {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  blur?: number;
  hue?: number;
  grayscale?: number;
  sepia?: number;
}

interface OverlayItem {
  id: string;
  type: string;
  startMs: number;
  endMs: number;
  data: any;
  transform?: {
    x: number | string;
    y: number | string;
    width: number | string;
    height: number | string;
    rotation: number;
    opacity: number;
  };
  filters?: OverlayItemFilters;
}

interface OverlayLayerProps {
  items: OverlayItem[];
  fps: number;
}

function buildFilterString(filters?: OverlayItemFilters): string | undefined {
  if (!filters) return undefined;

  const parts: string[] = [];

  if (filters.brightness !== undefined && filters.brightness !== 1) {
    parts.push(`brightness(${filters.brightness})`);
  }
  if (filters.contrast !== undefined && filters.contrast !== 1) {
    parts.push(`contrast(${filters.contrast})`);
  }
  if (filters.saturation !== undefined && filters.saturation !== 1) {
    parts.push(`saturate(${filters.saturation})`);
  }
  if (filters.blur !== undefined && filters.blur !== 0) {
    parts.push(`blur(${filters.blur}px)`);
  }
  if (filters.hue !== undefined && filters.hue !== 0) {
    parts.push(`hue-rotate(${filters.hue}deg)`);
  }
  if (filters.grayscale !== undefined && filters.grayscale !== 0) {
    parts.push(`grayscale(${filters.grayscale})`);
  }
  if (filters.sepia !== undefined && filters.sepia !== 0) {
    parts.push(`sepia(${filters.sepia})`);
  }

  return parts.length > 0 ? parts.join(' ') : undefined;
}

export const OverlayLayer: React.FC<OverlayLayerProps> = ({ items, fps }) => {
  return (
    <AbsoluteFill>
      {items.map((item) => {
        const startFrame = Math.round((item.startMs / 1000) * fps);
        const endFrame = Math.round((item.endMs / 1000) * fps);
        const durationInFrames = Math.max(1, endFrame - startFrame);

        // Audio items: no visual wrapper
        if (item.type === 'audio') {
          return (
            <Sequence
              key={item.id}
              from={startFrame}
              durationInFrames={durationInFrames}
            >
              <AudioOverlay data={item.data} />
            </Sequence>
          );
        }

        // Visual items: text, image, video
        const { transform, filters } = item;
        const filterStr = buildFilterString(filters);

        return (
          <Sequence
            key={item.id}
            from={startFrame}
            durationInFrames={durationInFrames}
          >
            <div
              style={{
                position: 'absolute',
                left: transform?.x ?? 0,
                top: transform?.y ?? 0,
                width: transform?.width ?? '100%',
                height: transform?.height ?? '100%',
                transform: transform?.rotation
                  ? `rotate(${transform.rotation}deg)`
                  : undefined,
                opacity: transform?.opacity ?? 1,
                filter: filterStr,
              }}
            >
              {item.type === 'text' && <TextOverlay data={item.data} />}
              {item.type === 'image' && <ImageOverlay data={item.data} />}
              {item.type === 'video' && <VideoOverlay data={item.data} />}
            </div>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
