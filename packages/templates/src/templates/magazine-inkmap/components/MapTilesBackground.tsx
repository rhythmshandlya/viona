import { useMemo, useState, useCallback } from 'react';
import { AbsoluteFill, Img, delayRender, continueRender } from 'remotion';

function lngToTileX(lng: number, zoom: number): number {
  return Math.floor(((lng + 180) / 360) * Math.pow(2, zoom));
}

function latToTileY(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
      Math.pow(2, zoom),
  );
}

function lngToPixelX(lng: number, zoom: number): number {
  return ((lng + 180) / 360) * Math.pow(2, zoom) * 256;
}

function latToPixelY(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180;
  return (
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
    Math.pow(2, zoom) *
    256
  );
}

interface MapTilesBackgroundProps {
  lat: number;
  lng: number;
  zoom: number;
  width?: number;
  height?: number;
  /** Where the lat/lng should appear on screen (x). Defaults to viewport center. */
  viewCenterX?: number;
  /** Where the lat/lng should appear on screen (y). Defaults to viewport center. */
  viewCenterY?: number;
  opacity?: number;
  seed?: string;
}

/**
 * OSM tiles rendered as a subtle desaturated background.
 * Clean grayscale with light contrast — no sepia, no blend modes.
 */
export function MapTilesBackground({
  lat,
  lng,
  zoom,
  width = 1080,
  height = 1920,
  viewCenterX,
  viewCenterY,
  opacity = 1,
  seed = 'map-bg',
}: MapTilesBackgroundProps) {
  const filterId = `map-desat-${seed}`;

  const anchorX = viewCenterX ?? width / 2;
  const anchorY = viewCenterY ?? height / 2;

  const tiles = useMemo(() => {
    const centerPx = lngToPixelX(lng, zoom);
    const centerPy = latToPixelY(lat, zoom);
    const tilesX = Math.ceil(width / 256) + 2;
    const tilesY = Math.ceil(height / 256) + 2;
    const centerTileX = lngToTileX(lng, zoom);
    const centerTileY = latToTileY(lat, zoom);
    const halfX = Math.floor(tilesX / 2);
    const halfY = Math.floor(tilesY / 2);

    const result: Array<{ key: string; url: string; x: number; y: number }> = [];

    for (let dx = -halfX; dx <= halfX; dx++) {
      for (let dy = -halfY; dy <= halfY; dy++) {
        const tileX = centerTileX + dx;
        const tileY = centerTileY + dy;
        const maxTile = Math.pow(2, zoom);
        if (tileY < 0 || tileY >= maxTile) continue;
        const wrappedX = ((tileX % maxTile) + maxTile) % maxTile;
        const tilePxX = tileX * 256;
        const tilePxY = tileY * 256;

        result.push({
          key: `${zoom}-${wrappedX}-${tileY}`,
          url: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${tileY}.png`,
          x: tilePxX - centerPx + anchorX,
          y: tilePxY - centerPy + anchorY,
        });
      }
    }
    return result;
  }, [lat, lng, zoom, width, height, anchorX, anchorY]);

  const [handle] = useState(() => delayRender('Loading map tiles'));
  const totalTiles = tiles.length;

  if (totalTiles === 0) {
    continueRender(handle);
  }

  const [, setLoadedCount] = useState(0);

  const onLoad = useCallback(() => {
    setLoadedCount((prev) => {
      const next = prev + 1;
      if (next >= totalTiles) continueRender(handle);
      return next;
    });
  }, [totalTiles, handle]);

  const onError = useCallback(() => {
    setLoadedCount((prev) => {
      const next = prev + 1;
      if (next >= totalTiles) continueRender(handle);
      return next;
    });
  }, [totalTiles, handle]);

  return (
    <AbsoluteFill style={{ opacity, overflow: 'hidden' }}>
      {/* Desaturate + lighten for subtle background */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <filter id={filterId}>
            <feColorMatrix type="saturate" values="0.05" />
            <feComponentTransfer>
              <feFuncR type="linear" slope="0.6" intercept="0.38" />
              <feFuncG type="linear" slope="0.6" intercept="0.38" />
              <feFuncB type="linear" slope="0.6" intercept="0.4" />
            </feComponentTransfer>
          </filter>
        </defs>
      </svg>

      {tiles.map((tile) => (
        <Img
          key={tile.key}
          src={tile.url}
          onLoad={onLoad}
          onError={onError}
          style={{
            position: 'absolute',
            left: tile.x,
            top: tile.y,
            width: 256,
            height: 256,
            filter: `url(#${filterId})`,
          }}
        />
      ))}
    </AbsoluteFill>
  );
}
