/**
 * Slippy map tile math — pure functions for converting between
 * lat/lng coordinates and pixel/tile positions.
 * Based on watercolor-map tile-math with satellite style + bbox viewport.
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
 * Compute a viewport that fits a bounding box [minLng, minLat, maxLng, maxLat]
 * centered in the given width/height with padding.
 */
export function computeBboxViewport(
  bbox: [number, number, number, number],
  width: number,
  height: number,
  padding: number
): Viewport {
  const [minLng, minLat, maxLng, maxLat] = bbox;

  const zoom = fitZoom(minLat, minLng, maxLat, maxLng, width, height, padding);

  const pxMinLng = lngToPixelX(minLng, zoom);
  const pyMinLat = latToPixelY(minLat, zoom);
  const pxMaxLng = lngToPixelX(maxLng, zoom);
  const pyMaxLat = latToPixelY(maxLat, zoom);

  const centerX = (pxMinLng + pxMaxLng) / 2;
  const centerY = (pyMinLat + pyMaxLat) / 2;

  const offsetX = width / 2 - centerX;
  const offsetY = height / 2 - centerY;

  return {
    zoom,
    offsetX,
    offsetY,
    point1: { x: pxMinLng + offsetX, y: pyMaxLat + offsetY },
    point2: { x: pxMaxLng + offsetX, y: pyMinLat + offsetY },
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

export type MapStyle = 'satellite' | 'watercolor' | 'toner' | 'tonerLite' | 'terrain' | 'osm';

export interface MapStyleConfig {
  urlTemplate: string;
  background: string;
  darkMap: boolean;
}

export const MAP_STYLES: Record<MapStyle, MapStyleConfig> = {
  satellite: {
    urlTemplate:
      'https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    background: '#1a1a2e',
    darkMap: true,
  },
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

/**
 * Get the tile URL for the given style and coordinates.
 */
export function getTileUrl(
  tileX: number,
  tileY: number,
  zoom: number,
  style: MapStyle = 'satellite'
): string {
  return MAP_STYLES[style].urlTemplate
    .replace('{z}', String(zoom))
    .replace('{x}', String(tileX))
    .replace('{y}', String(tileY));
}
