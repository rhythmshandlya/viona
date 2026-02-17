/**
 * Slippy map tile math — pure functions for converting between
 * lat/lng coordinates and pixel/tile positions.
 */

const TILE_SIZE = 256;

export function lngToTileX(lng: number, zoom: number): number {
  return ((lng + 180) / 360) * Math.pow(2, zoom);
}

export function latToTileY(lat: number, zoom: number): number {
  const latRad = (lat * Math.PI) / 180;
  return (
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
    Math.pow(2, zoom)
  );
}

export function lngToPixelX(lng: number, zoom: number): number {
  return lngToTileX(lng, zoom) * TILE_SIZE;
}

export function latToPixelY(lat: number, zoom: number): number {
  return latToTileY(lat, zoom) * TILE_SIZE;
}

/**
 * Find the highest zoom level (max 16) where both points fit
 * within the given viewport dimensions with padding.
 */
export function fitZoom(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  width: number,
  height: number,
  padding: number
): number {
  const effectiveWidth = width - padding * 2;
  const effectiveHeight = height - padding * 2;

  for (let z = 16; z >= 1; z--) {
    const px1 = lngToPixelX(lng1, z);
    const py1 = latToPixelY(lat1, z);
    const px2 = lngToPixelX(lng2, z);
    const py2 = latToPixelY(lat2, z);

    const dx = Math.abs(px2 - px1);
    const dy = Math.abs(py2 - py1);

    if (dx <= effectiveWidth && dy <= effectiveHeight) {
      return z;
    }
  }
  return 1;
}

export interface Viewport {
  zoom: number;
  offsetX: number;
  offsetY: number;
  point1: { x: number; y: number };
  point2: { x: number; y: number };
}

/**
 * Compute the viewport transformation: world-to-screen offsets
 * and the screen-space positions of the two points.
 */
export function computeViewport(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  width: number,
  height: number,
  padding: number
): Viewport {
  const zoom = fitZoom(lat1, lng1, lat2, lng2, width, height, padding);

  const px1 = lngToPixelX(lng1, zoom);
  const py1 = latToPixelY(lat1, zoom);
  const px2 = lngToPixelX(lng2, zoom);
  const py2 = latToPixelY(lat2, zoom);

  // Center both points in the viewport
  const centerX = (px1 + px2) / 2;
  const centerY = (py1 + py2) / 2;

  const offsetX = width / 2 - centerX;
  const offsetY = height / 2 - centerY;

  return {
    zoom,
    offsetX,
    offsetY,
    point1: { x: px1 + offsetX, y: py1 + offsetY },
    point2: { x: px2 + offsetX, y: py2 + offsetY },
  };
}

export interface TileInfo {
  tileX: number;
  tileY: number;
  screenX: number;
  screenY: number;
}

/**
 * Get the list of map tiles needed to cover the viewport.
 */
export function getTilesForViewport(
  viewport: Viewport,
  width: number,
  height: number,
  margin: number = 0
): TileInfo[] {
  const { zoom, offsetX, offsetY } = viewport;

  // Convert viewport corners to tile coordinates (with optional margin for camera panning)
  const worldLeft = -offsetX - margin;
  const worldTop = -offsetY - margin;
  const worldRight = worldLeft + width + margin * 2;
  const worldBottom = worldTop + height + margin * 2;

  const tileXMin = Math.floor(worldLeft / TILE_SIZE);
  const tileXMax = Math.floor(worldRight / TILE_SIZE);
  const tileYMin = Math.floor(worldTop / TILE_SIZE);
  const tileYMax = Math.floor(worldBottom / TILE_SIZE);

  const maxTile = Math.pow(2, zoom) - 1;
  const tiles: TileInfo[] = [];

  for (let tx = tileXMin; tx <= tileXMax; tx++) {
    for (let ty = tileYMin; ty <= tileYMax; ty++) {
      if (ty < 0 || ty > maxTile) continue;
      // Wrap X around the world
      const wrappedX = ((tx % (maxTile + 1)) + (maxTile + 1)) % (maxTile + 1);

      tiles.push({
        tileX: wrappedX,
        tileY: ty,
        screenX: tx * TILE_SIZE + offsetX,
        screenY: ty * TILE_SIZE + offsetY,
      });
    }
  }

  return tiles;
}

export type MapStyle = 'watercolor' | 'toner' | 'tonerLite' | 'terrain' | 'osm';

export interface MapStyleConfig {
  urlTemplate: string;
  background: string;
  darkMap: boolean;
}

export const MAP_STYLES: Record<MapStyle, MapStyleConfig> = {
  watercolor: {
    urlTemplate: 'https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg',
    background: '#F5F0EB',
    darkMap: false,
  },
  toner: {
    urlTemplate: 'https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}.png',
    background: '#000000',
    darkMap: true,
  },
  tonerLite: {
    urlTemplate: 'https://tiles.stadiamaps.com/tiles/stamen_toner_lite/{z}/{x}/{y}.png',
    background: '#FFFFFF',
    darkMap: false,
  },
  terrain: {
    urlTemplate: 'https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}.png',
    background: '#F4F0E8',
    darkMap: false,
  },
  osm: {
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    background: '#E8E0D8',
    darkMap: false,
  },
};

export interface MultiPointViewport {
  zoom: number;
  offsetX: number;
  offsetY: number;
  points: { x: number; y: number }[];
}

/**
 * Compute a viewport that fits an arbitrary list of coordinates.
 * Used by multiStop and hubAndSpoke animation types.
 */
export function computeMultiPointViewport(
  coords: { lat: number; lng: number }[],
  width: number,
  height: number,
  padding: number
): MultiPointViewport {
  if (coords.length < 2) {
    throw new Error('computeMultiPointViewport requires at least 2 coordinates');
  }

  const lats = coords.map((c) => c.lat);
  const lngs = coords.map((c) => c.lng);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  // Find highest zoom where bounding box fits
  const zoom = fitZoom(minLat, minLng, maxLat, maxLng, width, height, padding);

  // Convert all coords to pixel space
  const pixelPoints = coords.map((c) => ({
    px: lngToPixelX(c.lng, zoom),
    py: latToPixelY(c.lat, zoom),
  }));

  // Center bounding box in viewport
  const allPx = pixelPoints.map((p) => p.px);
  const allPy = pixelPoints.map((p) => p.py);
  const centerX = (Math.min(...allPx) + Math.max(...allPx)) / 2;
  const centerY = (Math.min(...allPy) + Math.max(...allPy)) / 2;

  const offsetX = width / 2 - centerX;
  const offsetY = height / 2 - centerY;

  return {
    zoom,
    offsetX,
    offsetY,
    points: pixelPoints.map((p) => ({
      x: p.px + offsetX,
      y: p.py + offsetY,
    })),
  };
}

/**
 * Compute the control point for a quadratic bezier curve between two points.
 */
export function computeBezierControl(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  curveIntensity: number
): { cx: number; cy: number } {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const offset = curveIntensity * dist * 0.4;
  const nx = -dy / dist;
  const ny = dx / dist;
  return { cx: midX + nx * offset, cy: midY + ny * offset };
}

/**
 * Get a point along a quadratic bezier curve at parameter t (0–1).
 */
export function getPointOnQuadBezier(
  x1: number,
  y1: number,
  cx: number,
  cy: number,
  x2: number,
  y2: number,
  t: number
): { x: number; y: number } {
  const u = 1 - t;
  return {
    x: u * u * x1 + 2 * u * t * cx + t * t * x2,
    y: u * u * y1 + 2 * u * t * cy + t * t * y2,
  };
}

/**
 * Get the tile URL for the given style and coordinates.
 */
export function getTileUrl(
  tileX: number,
  tileY: number,
  zoom: number,
  style: MapStyle = 'watercolor'
): string {
  return MAP_STYLES[style].urlTemplate
    .replace('{z}', String(zoom))
    .replace('{x}', String(tileX))
    .replace('{y}', String(tileY));
}
