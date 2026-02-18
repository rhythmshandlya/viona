/**
 * Utilities for projecting GeoJSON coordinates to screen-space SVG paths
 * with Catmull-Rom spline smoothing for natural-looking borders.
 */

import { lngToPixelX, latToPixelY } from './tile-math';

/**
 * Project a [lng, lat] coordinate to screen pixel position at the given zoom + offset.
 */
export function projectCoord(
  lng: number,
  lat: number,
  zoom: number,
  offsetX: number,
  offsetY: number
): { x: number; y: number } {
  return {
    x: lngToPixelX(lng, zoom) + offsetX,
    y: latToPixelY(lat, zoom) + offsetY,
  };
}

/**
 * Convert Catmull-Rom segment to cubic Bezier control points.
 * Takes 4 sequential points (p0, p1, p2, p3) and produces the two
 * cubic bezier control points for the segment between p1 and p2.
 * Alpha controls tension (0.5 = centripetal, good for geographic shapes).
 */
function catmullRomToBezier(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  alpha: number = 0.5
): { cp1: { x: number; y: number }; cp2: { x: number; y: number } } {
  const d1 = Math.sqrt((p1.x - p0.x) ** 2 + (p1.y - p0.y) ** 2);
  const d2 = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
  const d3 = Math.sqrt((p3.x - p2.x) ** 2 + (p3.y - p2.y) ** 2);

  const d1a = Math.pow(d1, alpha);
  const d2a = Math.pow(d2, alpha);
  const d3a = Math.pow(d3, alpha);

  // Avoid division by zero
  const eps = 1e-6;

  const cp1 = {
    x:
      (d1a * d1a * p2.x - d2a * d2a * p0.x + (2 * d1a * d1a + 3 * d1a * d2a + d2a * d2a) * p1.x) /
      (3 * d1a * (d1a + d2a) + eps),
    y:
      (d1a * d1a * p2.y - d2a * d2a * p0.y + (2 * d1a * d1a + 3 * d1a * d2a + d2a * d2a) * p1.y) /
      (3 * d1a * (d1a + d2a) + eps),
  };

  const cp2 = {
    x:
      (d3a * d3a * p1.x - d2a * d2a * p3.x + (2 * d3a * d3a + 3 * d3a * d2a + d2a * d2a) * p2.x) /
      (3 * d3a * (d3a + d2a) + eps),
    y:
      (d3a * d3a * p1.y - d2a * d2a * p3.y + (2 * d3a * d3a + 3 * d3a * d2a + d2a * d2a) * p2.y) /
      (3 * d3a * (d3a + d2a) + eps),
  };

  return { cp1, cp2 };
}

/**
 * Convert a polygon ring [lng, lat][] to a smooth SVG path using
 * Catmull-Rom → cubic Bezier conversion.
 */
export function polygonToSvgPath(
  ring: [number, number][],
  zoom: number,
  offsetX: number,
  offsetY: number
): string {
  if (ring.length < 3) return '';

  // Project all points
  const points = ring.map(([lng, lat]) => projectCoord(lng, lat, zoom, offsetX, offsetY));

  // Remove duplicate closing point if present
  const last = points[points.length - 1];
  const first = points[0];
  const pts =
    Math.abs(last.x - first.x) < 0.5 && Math.abs(last.y - first.y) < 0.5
      ? points.slice(0, -1)
      : points;

  if (pts.length < 3) return '';

  const n = pts.length;
  const parts: string[] = [];

  // Start at first point
  parts.push(`M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`);

  // Generate cubic bezier curves for each segment
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];

    const { cp1, cp2 } = catmullRomToBezier(p0, p1, p2, p3);

    parts.push(
      `C${cp1.x.toFixed(1)},${cp1.y.toFixed(1)} ${cp2.x.toFixed(1)},${cp2.y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
    );
  }

  parts.push('Z');
  return parts.join(' ');
}

/**
 * Convert all polygons of a country to SVG path `d` strings.
 */
export function countryToSvgPaths(
  polygons: [number, number][][],
  zoom: number,
  offsetX: number,
  offsetY: number
): string[] {
  return polygons.map((ring) => polygonToSvgPath(ring, zoom, offsetX, offsetY));
}
