import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { TextOverlay } from './TextOverlay';
import { ImageOverlay } from './ImageOverlay';
import { VideoOverlay } from './VideoOverlay';
import { ShapeOverlay } from './ShapeOverlay';
import { useKeyframeInterpolation } from './useKeyframeInterpolation';

interface OverlayItemFilters {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  blur?: number;
  hue?: number;
  grayscale?: number;
  sepia?: number;
}

interface OverlayItemType {
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
  keyframes?: {
    timeMs: number;
    props: Partial<{
      x: number | string;
      y: number | string;
      width: number | string;
      height: number | string;
      rotation: number;
      opacity: number;
    }>;
    easing?: string;
  }[];
  filters?: OverlayItemFilters;
}

interface OverlayLayerProps {
  items: OverlayItemType[];
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

/** Per-item renderer — uses hooks for keyframe interpolation */
const OverlayItem: React.FC<{ item: OverlayItemType }> = ({ item }) => {
  const interpolatedTransform = useKeyframeInterpolation(
    item.transform,
    item.keyframes,
  );

  const filterStr = buildFilterString(item.filters);

  return (
    <div
      style={{
        position: 'absolute',
        left: interpolatedTransform.x,
        top: interpolatedTransform.y,
        width: interpolatedTransform.width,
        height: interpolatedTransform.height,
        transform: interpolatedTransform.rotation
          ? `rotate(${interpolatedTransform.rotation}deg)`
          : undefined,
        opacity: interpolatedTransform.opacity,
        filter: filterStr,
      }}
    >
      {item.type === 'text' && <TextOverlay data={item.data} />}
      {item.type === 'image' && <ImageOverlay data={item.data} />}
      {item.type === 'video' && <VideoOverlay data={item.data} />}
      {item.type === 'shape' && <ShapeOverlay data={item.data} />}
    </div>
  );
};

export const OverlayLayer: React.FC<OverlayLayerProps> = ({ items, fps }) => {
  return (
    <AbsoluteFill>
      {items.map((item) => {
        const startFrame = Math.round((item.startMs / 1000) * fps);
        const endFrame = Math.round((item.endMs / 1000) * fps);
        const durationInFrames = Math.max(1, endFrame - startFrame);

        return (
          <Sequence
            key={item.id}
            from={startFrame}
            durationInFrames={durationInFrames}
          >
            <OverlayItem item={item} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
