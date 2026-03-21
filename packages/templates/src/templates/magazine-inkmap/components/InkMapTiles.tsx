import React, { useMemo, useState, useCallback } from 'react';
import { AbsoluteFill, Img, delayRender, continueRender } from 'remotion';

// ── Tile math (standalone, no lib/map import) ──────────────────────────────

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

// ── Component ──────────────────────────────────────────────────────────────

interface InkMapTilesProps {
  lat: number;
  lng: number;
  zoom: number;
  width?: number;
  height?: number;
  opacity?: number;
  seed?: string;
}

/**
 * Renders OSM raster tiles with a sepia ink treatment.
 * Uses Remotion's <Img> + delayRender/continueRender for async tile loading.
 * Applies SVG feColorMatrix for desaturation + sepia, rendered with
 * mix-blend-mode: multiply against the paper texture.
 */
export function InkMapTiles({
  lat,
  lng,
  zoom,
  width = 1080,
  height = 1920,
  opacity = 1,
  seed = 'inkmap-tiles',
}: InkMapTilesProps) {
  const filterId = `magazine-sepia-${seed}`;

  const tiles = useMemo(() => {
    const centerPx = lngToPixelX(lng, zoom);
    const centerPy = latToPixelY(lat, zoom);

    // How many tiles we need to cover the viewport
    const tilesX = Math.ceil(width / 256) + 2;
    const tilesY = Math.ceil(height / 256) + 2;

    const centerTileX = lngToTileX(lng, zoom);
    const centerTileY = latToTileY(lat, zoom);

    const halfX = Math.floor(tilesX / 2);
    const halfY = Math.floor(tilesY / 2);

    const result: Array<{
      key: string;
      url: string;
      x: number;
      y: number;
    }> = [];

    for (let dx = -halfX; dx <= halfX; dx++) {
      for (let dy = -halfY; dy <= halfY; dy++) {
        const tileX = centerTileX + dx;
        const tileY = centerTileY + dy;

        // Skip tiles outside valid range
        const maxTile = Math.pow(2, zoom);
        if (tileY < 0 || tileY >= maxTile) continue;
        const wrappedX = ((tileX % maxTile) + maxTile) % maxTile;

        const tilePxX = tileX * 256;
        const tilePxY = tileY * 256;

        // Position relative to viewport center
        const screenX = tilePxX - centerPx + width / 2;
        const screenY = tilePxY - centerPy + height / 2;

        result.push({
          key: `${zoom}-${wrappedX}-${tileY}`,
          url: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${tileY}.png`,
          x: screenX,
          y: screenY,
        });
      }
    }

    return result;
  }, [lat, lng, zoom, width, height]);

  // Track loading of all tiles
  const [handle] = useState(() => delayRender('Loading map tiles'));
  const [loadedCount, setLoadedCount] = useState(0);
  const totalTiles = tiles.length;

  const onTileLoad = useCallback(() => {
    setLoadedCount((prev) => {
      const next = prev + 1;
      if (next >= totalTiles) {
        continueRender(handle);
      }
      return next;
    });
  }, [totalTiles, handle]);

  const onTileError = useCallback(() => {
    // Don't block render on missing tiles
    setLoadedCount((prev) => {
      const next = prev + 1;
      if (next >= totalTiles) {
        continueRender(handle);
      }
      return next;
    });
  }, [totalTiles, handle]);

  return (
    <AbsoluteFill
      style={{
        opacity,
        mixBlendMode: 'multiply',
        overflow: 'hidden',
      }}
    >
      {/* SVG filter for sepia desaturation */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <filter id={filterId}>
            <feColorMatrix
              type="matrix"
              values="0.393 0.769 0.189 0 0
                      0.349 0.686 0.168 0 0
                      0.272 0.534 0.131 0 0
                      0     0     0     1 0"
            />
          </filter>
        </defs>
      </svg>

      {tiles.map((tile) => (
        <Img
          key={tile.key}
          src={tile.url}
          onLoad={onTileLoad}
          onError={onTileError}
          style={{
            position: 'absolute',
            left: tile.x,
            top: tile.y,
            width: 256,
            height: 256,
            filter: `url(#${filterId})`,
            imageRendering: 'auto',
          }}
        />
      ))}
    </AbsoluteFill>
  );
}
