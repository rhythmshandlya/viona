import React from 'react';
import { Img } from 'remotion';
import type { Viewport, MapStyle } from '../lib/tile-math';
import { getTilesForViewport, getTileUrl } from '../lib/tile-math';

interface MapTileGridProps {
  viewport: Viewport;
  width: number;
  height: number;
  mapStyle: MapStyle;
}

const MapTileGrid: React.FC<MapTileGridProps> = ({ viewport, width, height, mapStyle }) => {
  const tiles = getTilesForViewport(viewport, width, height);

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
