import React from 'react';
import { spring, useVideoConfig } from 'remotion';
import {
  lngToPixelX,
  latToPixelY,
  MapTileGrid,
  LocationMarker,
} from '../../../lib/map';
import type { Viewport, MapStyle } from '../../../lib/map';
import { PANEL_ZOOM } from '../constants';

interface SplitPanelProps {
  coord: { lat: number; lng: number; label?: string };
  panelWidth: number;
  panelHeight: number;
  frame: number;
  /** Direction the panel slides in from. */
  slideFrom: 'top' | 'bottom' | 'left' | 'right';
  mapStyle: MapStyle;
  markerColor: string;
  /** Frame at which the panel entrance spring starts. */
  enterFrame: number;
  /** Frame at which the marker appears. */
  markerEnterFrame: number;
}

/**
 * Compute a viewport centered on a single coordinate at a fixed zoom level.
 */
function computeSinglePointViewport(
  lat: number,
  lng: number,
  panelWidth: number,
  panelHeight: number,
): Viewport {
  const zoom = PANEL_ZOOM;
  const px = lngToPixelX(lng, zoom);
  const py = latToPixelY(lat, zoom);

  const offsetX = panelWidth / 2 - px;
  const offsetY = panelHeight / 2 - py;

  return {
    zoom,
    offsetX,
    offsetY,
    point1: { x: px + offsetX, y: py + offsetY },
    point2: { x: px + offsetX, y: py + offsetY },
  };
}

const SplitPanel: React.FC<SplitPanelProps> = ({
  coord,
  panelWidth,
  panelHeight,
  frame,
  slideFrom,
  mapStyle,
  markerColor,
  enterFrame,
  markerEnterFrame,
}) => {
  const { fps } = useVideoConfig();

  const viewport = computeSinglePointViewport(coord.lat, coord.lng, panelWidth, panelHeight);

  // Slide-in animation using spring
  const localFrame = Math.max(0, frame - enterFrame);
  const slideProgress = spring({
    frame: localFrame,
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });

  // Compute the translate offset based on slide direction
  let translateX = 0;
  let translateY = 0;

  switch (slideFrom) {
    case 'top':
      translateY = (1 - slideProgress) * -panelHeight;
      break;
    case 'bottom':
      translateY = (1 - slideProgress) * panelHeight;
      break;
    case 'left':
      translateX = (1 - slideProgress) * -panelWidth;
      break;
    case 'right':
      translateX = (1 - slideProgress) * panelWidth;
      break;
  }

  // Marker screen position (center of the panel)
  const markerX = panelWidth / 2;
  const markerY = panelHeight / 2;

  return (
    <div
      style={{
        width: panelWidth,
        height: panelHeight,
        position: 'relative',
        overflow: 'hidden',
        transform: `translate(${translateX}px, ${translateY}px)`,
        borderRadius: 12,
      }}
    >
      {/* Map tile layer */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <MapTileGrid
          viewport={viewport}
          width={panelWidth}
          height={panelHeight}
          mapStyle={mapStyle}
          margin={0}
        />
      </div>

      {/* Location marker */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <LocationMarker
          x={markerX}
          y={markerY}
          frame={frame}
          enterFrame={markerEnterFrame}
          color={markerColor}
          size={18}
          markerStyle="pulse"
        />
      </div>
    </div>
  );
};

export default SplitPanel;
