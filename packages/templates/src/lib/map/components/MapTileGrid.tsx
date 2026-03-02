import React from 'react';
import { Img } from 'remotion';
import type { Viewport, MapStyle } from '../types';
import { getTilesForViewport, getTileUrl } from '../tile-math';

interface MapTileGridProps {
  viewport: Viewport;
  width: number;
  height: number;
  mapStyle: MapStyle;
  margin?: number;
}

const MapTileGrid: React.FC<MapTileGridProps> = ({ viewport, width, height, mapStyle, margin = 0 }) => {
  const tiles = getTilesForViewport(viewport, width, height, margin);

  return (
    <>
      {tiles.map((tile) => (
        <Img
          key={`${tile.tileX}-${tile.tileY}`}
          src={getTileUrl(tile.tileX, tile.tileY, viewport.zoom, mapStyle)}
          maxRetries={3}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
          style={{
            position: 'absolute',
            left: tile.screenX,
            top: tile.screenY,
            width: 256,
            height: 256,
          }}
        />
      ))}
    </>
  );
};

export default MapTileGrid;
