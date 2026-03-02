/**
 * Shared types for map templates.
 */

/** A geographic coordinate with optional label. */
export interface Coord {
  lat: number;
  lng: number;
  label?: string;
}

/** Viewport for a 2-point map view. */
export interface Viewport {
  zoom: number;
  offsetX: number;
  offsetY: number;
  point1: { x: number; y: number };
  point2: { x: number; y: number };
}

/** Viewport for an N-point map view. */
export interface MultiPointViewport {
  zoom: number;
  offsetX: number;
  offsetY: number;
  points: { x: number; y: number }[];
}

/** Individual tile position info. */
export interface TileInfo {
  tileX: number;
  tileY: number;
  screenX: number;
  screenY: number;
}

/** Map style identifier. */
export type MapStyle =
  | 'satellite'
  | 'watercolor'
  | 'toner'
  | 'tonerLite'
  | 'terrain'
  | 'osm'
  | 'darkMatter'
  | 'voyager'
  | 'positron';

/** Configuration for a map tile provider. */
export interface MapStyleConfig {
  urlTemplate: string;
  background: string;
  darkMap: boolean;
}
