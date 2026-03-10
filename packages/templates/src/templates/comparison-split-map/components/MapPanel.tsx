import React from 'react';
import { MapTileGrid } from '../../../lib/map';
import type { Viewport, MapStyle } from '../../../lib/map';

interface MapPanelProps {
  viewport: Viewport;
  width: number;
  height: number;
  mapStyle: MapStyle;
  /** Percentage of the panel clipped from the left edge (0–100) */
  clipLeft: number;
  /** Percentage of the panel clipped from the right edge (0–100) */
  clipRight: number;
  margin?: number;
}

const MapPanel: React.FC<MapPanelProps> = ({
  viewport,
  width,
  height,
  mapStyle,
  clipLeft,
  clipRight,
  margin = 0,
}) => {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        clipPath: `inset(0 ${clipRight}% 0 ${clipLeft}%)`,
        overflow: 'hidden',
      }}
    >
      <MapTileGrid
        viewport={viewport}
        width={width}
        height={height}
        mapStyle={mapStyle}
        margin={margin}
      />
    </div>
  );
};

export default MapPanel;
